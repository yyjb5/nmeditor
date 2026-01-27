use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{BufReader, Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

/// Choose delimiter from user input; supports "\t" for tabs and falls back to comma.
fn parse_delimiter(input: &str) -> u8 {
    if input == "\\t" {
        b'\t'
    } else {
        input.as_bytes().first().copied().unwrap_or(b',')
    }
}

/// Detect a likely delimiter by counting occurrences in a sample slice.
fn detect_delimiter(sample: &str) -> u8 {
    let candidates = [(',', b','), (';', b';'), ('\t', b'\t'), ('|', b'|')];
    let mut best = (0usize, b',');
    for (ch, byte) in candidates {
        let count = sample.matches(ch).count();
        if count > best.0 {
            best = (count, byte);
        }
    }
    best.1
}

fn normalize_terminator(eol: Option<String>) -> csv::Terminator {
    match eol.as_deref() {
        Some("LF") => csv::Terminator::Any(b'\n'),
        _ => csv::Terminator::CRLF,
    }
}

fn rewrite_with_utf8_bom(path: &str, bom: bool) -> Result<(), String> {
    if !bom {
        return Ok(());
    }
    let mut content = Vec::new();
    File::open(path)
        .map_err(|e| e.to_string())?
        .read_to_end(&mut content)
        .map_err(|e| e.to_string())?;
    let mut file = File::options()
        .write(true)
        .truncate(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(&[0xEF, 0xBB, 0xBF]).map_err(|e| e.to_string())?;
    file.write_all(&content).map_err(|e| e.to_string())?;
    Ok(())
}

fn rewrite_as_utf16le(path: &str, bom: bool) -> Result<(), String> {
    let mut content = Vec::new();
    File::open(path)
        .map_err(|e| e.to_string())?
        .read_to_end(&mut content)
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8(content).map_err(|e| e.to_string())?;
    let utf16: Vec<u8> = text.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
    let mut file = File::options()
        .write(true)
        .truncate(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    if bom {
        file.write_all(&[0xFF, 0xFE]).map_err(|e| e.to_string())?;
    }
    file.write_all(&utf16).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct CsvPreview {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub delimiter: String,
    pub path: String,
}

#[derive(Serialize, Deserialize)]
pub struct CsvSlice {
    pub rows: Vec<Vec<String>>,
    pub start: usize,
    pub end: usize,
    pub eof: bool,
}

#[derive(Serialize, Deserialize)]
pub struct CsvSessionInfo {
    pub session_id: u64,
    pub headers: Vec<String>,
    pub delimiter: String,
    pub path: String,
}

#[derive(Serialize, Deserialize)]
pub struct CsvPatch {
    pub row: usize,
    pub col: usize,
    pub value: String,
}

#[derive(Serialize, Deserialize)]
pub struct CsvMacroSpec {
    pub op: String,
    pub column: usize,
    pub find: Option<String>,
    pub replace: Option<String>,
    pub text: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CsvMacroResult {
    pub output_path: String,
    pub applied: usize,
}

#[derive(Serialize, Deserialize)]
pub struct ColumnStat {
    pub name: String,
    pub non_empty: usize,
    pub distinct: usize,
    pub distinct_truncated: bool,
    pub inferred: String,
}

#[derive(Serialize, Deserialize)]
pub struct FindReplaceSpec {
    pub find: String,
    pub replace: String,
    pub column: Option<usize>,
    pub regex: bool,
    pub match_case: bool,
}

#[derive(Serialize, Deserialize)]
pub struct FindReplaceResult {
    pub output_path: String,
    pub applied: usize,
}

struct CsvSession {
    reader: csv::Reader<BufReader<File>>,
    row_index: usize,
    eof: bool,
}

struct AppState {
    sessions: Mutex<HashMap<u64, CsvSession>>,
    next_id: AtomicU64,
}

/// Load the first chunk of a CSV for preview, using a detected or provided delimiter.
#[tauri::command]
fn preview_csv(path: String, delimiter: Option<String>) -> Result<CsvPreview, String> {
    let path_buf = PathBuf::from(&path);

    // Sample a small slice to guess the delimiter if not provided.
    let mut sample = String::new();
    let sample_reader = BufReader::new(File::open(&path_buf).map_err(|e| e.to_string())?);
    sample_reader
        .take(64 * 1024)
        .read_to_string(&mut sample)
        .map_err(|e| e.to_string())?;

    let delimiter_byte = delimiter
        .as_deref()
        .map(parse_delimiter)
        .unwrap_or_else(|| detect_delimiter(&sample));

    // Re-open for actual CSV read to avoid consuming the sample handle.
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .from_reader(File::open(&path_buf).map_err(|e| e.to_string())?);

    let headers = reader
        .headers()
        .map(|h| h.iter().map(|s| s.to_string()).collect::<Vec<_>>())
        .map_err(|e| e.to_string())?;

    let mut rows = Vec::new();
    for rec in reader.records().take(200) {
        let record = rec.map_err(|e| e.to_string())?;
        rows.push(record.iter().map(|s| s.to_string()).collect());
    }

    let delimiter_str = match delimiter_byte {
        b'\t' => "\\t".to_string(),
        other => String::from_utf8_lossy(&[other]).to_string(),
    };

    Ok(CsvPreview {
        headers,
        rows,
        delimiter: delimiter_str,
        path,
    })
}

#[tauri::command]
fn open_csv_session(
    state: tauri::State<AppState>,
    path: String,
    delimiter: Option<String>,
) -> Result<CsvSessionInfo, String> {
    let path_buf = PathBuf::from(&path);

    let mut sample = String::new();
    let sample_reader = BufReader::new(File::open(&path_buf).map_err(|e| e.to_string())?);
    sample_reader
        .take(64 * 1024)
        .read_to_string(&mut sample)
        .map_err(|e| e.to_string())?;

    let delimiter_byte = delimiter
        .as_deref()
        .map(parse_delimiter)
        .unwrap_or_else(|| detect_delimiter(&sample));

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .from_reader(BufReader::new(File::open(&path_buf).map_err(|e| e.to_string())?));

    let headers = reader
        .headers()
        .map(|h| h.iter().map(|s| s.to_string()).collect::<Vec<_>>())
        .map_err(|e| e.to_string())?;

    let session_id = state.next_id.fetch_add(1, Ordering::Relaxed);
    let mut sessions = state.sessions.lock().map_err(|_| "lock poisoned")?;
    sessions.insert(
        session_id,
        CsvSession {
            reader,
            row_index: 0,
            eof: false,
        },
    );

    let delimiter_str = match delimiter_byte {
        b'\t' => "\\t".to_string(),
        other => String::from_utf8_lossy(&[other]).to_string(),
    };

    Ok(CsvSessionInfo {
        session_id,
        headers,
        delimiter: delimiter_str,
        path,
    })
}

#[tauri::command]
fn read_csv_rows(
    state: tauri::State<AppState>,
    session_id: u64,
    limit: usize,
) -> Result<CsvSlice, String> {
    let mut sessions = state.sessions.lock().map_err(|_| "lock poisoned")?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "session not found".to_string())?;

    if session.eof {
        return Ok(CsvSlice {
            rows: Vec::new(),
            start: session.row_index,
            end: session.row_index,
            eof: true,
        });
    }

    let start = session.row_index;
    let mut rows = Vec::new();
    for rec in session.reader.records() {
        let record = rec.map_err(|e| e.to_string())?;
        rows.push(record.iter().map(|s| s.to_string()).collect());
        session.row_index += 1;
        if rows.len() >= limit {
            break;
        }
    }

    if rows.len() < limit {
        session.eof = true;
    }

    let end = start + rows.len();

    Ok(CsvSlice {
        rows,
        start,
        end,
        eof: session.eof,
    })
}

#[tauri::command]
fn close_csv_session(state: tauri::State<AppState>, session_id: u64) -> Result<bool, String> {
    let mut sessions = state.sessions.lock().map_err(|_| "lock poisoned")?;
    Ok(sessions.remove(&session_id).is_some())
}

#[tauri::command]
fn save_csv_with_patches(
    path: String,
    target_path: String,
    delimiter: String,
    patches: Vec<CsvPatch>,
    eol: Option<String>,
    bom: Option<bool>,
    encoding: Option<String>,
    quote: Option<String>,
    escape: Option<String>,
) -> Result<String, String> {
    let delimiter_byte = parse_delimiter(&delimiter);
    let eol_bytes = normalize_terminator(eol);
    let quote_byte = quote
        .as_deref()
        .and_then(|q| q.as_bytes().first().copied())
        .unwrap_or(b'"');
    let escape_byte = escape
        .as_deref()
        .and_then(|q| q.as_bytes().first().copied())
        .unwrap_or(b'"');

    let encoding = encoding.unwrap_or_else(|| "UTF-8".to_string());
    let use_utf16 = encoding.eq_ignore_ascii_case("UTF-16LE");
    let mut patch_map: HashMap<usize, HashMap<usize, String>> = HashMap::new();
    for patch in patches {
        patch_map
            .entry(patch.row)
            .or_default()
            .insert(patch.col, patch.value);
    }

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .from_reader(BufReader::new(File::open(&path).map_err(|e| e.to_string())?));

    let headers = reader
        .headers()
        .map(|h| h.iter().map(|s| s.to_string()).collect::<Vec<_>>())
        .map_err(|e| e.to_string())?;

    let mut writer = csv::WriterBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .terminator(eol_bytes)
        .quote(quote_byte)
        .escape(escape_byte)
        .from_path(&target_path)
        .map_err(|e| e.to_string())?;

    writer.write_record(&headers).map_err(|e| e.to_string())?;

    for (row_index, record) in reader.records().enumerate() {
        let record = record.map_err(|e| e.to_string())?;
        let mut row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
        if let Some(row_patches) = patch_map.get(&row_index) {
            for (col_idx, value) in row_patches {
                if *col_idx >= row.len() {
                    row.resize(col_idx + 1, String::new());
                }
                row[*col_idx] = value.clone();
            }
        }
        writer.write_record(&row).map_err(|e| e.to_string())?;
    }

    writer.flush().map_err(|e| e.to_string())?;

    if use_utf16 {
        rewrite_as_utf16le(&target_path, bom.unwrap_or(false))?;
        return Ok(target_path);
    }

    rewrite_with_utf8_bom(&target_path, bom.unwrap_or(false))?;
    Ok(target_path)
}

#[tauri::command]
fn apply_macro_to_file(
    path: String,
    target_path: String,
    delimiter: String,
    spec: CsvMacroSpec,
    eol: Option<String>,
    bom: Option<bool>,
    encoding: Option<String>,
    quote: Option<String>,
    escape: Option<String>,
) -> Result<CsvMacroResult, String> {
    let delimiter_byte = parse_delimiter(&delimiter);
    let eol_bytes = normalize_terminator(eol);
    let quote_byte = quote
        .as_deref()
        .and_then(|q| q.as_bytes().first().copied())
        .unwrap_or(b'"');
    let escape_byte = escape
        .as_deref()
        .and_then(|q| q.as_bytes().first().copied())
        .unwrap_or(b'"');

    let encoding = encoding.unwrap_or_else(|| "UTF-8".to_string());
    let use_utf16 = encoding.eq_ignore_ascii_case("UTF-16LE");
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .from_reader(BufReader::new(File::open(&path).map_err(|e| e.to_string())?));

    let headers = reader
        .headers()
        .map(|h| h.iter().map(|s| s.to_string()).collect::<Vec<_>>())
        .map_err(|e| e.to_string())?;

    let mut writer = csv::WriterBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .terminator(eol_bytes)
        .quote(quote_byte)
        .escape(escape_byte)
        .from_path(&target_path)
        .map_err(|e| e.to_string())?;

    writer.write_record(&headers).map_err(|e| e.to_string())?;

    let mut applied = 0usize;
    for record in reader.records() {
        let record = record.map_err(|e| e.to_string())?;
        let mut row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
        let col = spec.column;
        if col >= row.len() {
            row.resize(col + 1, String::new());
        }
        let current = row[col].clone();
        let next = match spec.op.as_str() {
            "replace" => {
                let find = spec.find.clone().unwrap_or_default();
                let replace = spec.replace.clone().unwrap_or_default();
                if find.is_empty() {
                    current.clone()
                } else {
                    current.replace(&find, &replace)
                }
            }
            "uppercase" => current.to_uppercase(),
            "lowercase" => current.to_lowercase(),
            "trim" => current.trim().to_string(),
            "prefix" => format!("{}{}", spec.text.clone().unwrap_or_default(), current),
            "suffix" => format!("{}{}", current, spec.text.clone().unwrap_or_default()),
            _ => current.clone(),
        };
        if next != current {
            row[col] = next;
            applied += 1;
        }
        writer.write_record(&row).map_err(|e| e.to_string())?;
    }

    writer.flush().map_err(|e| e.to_string())?;
    if use_utf16 {
        rewrite_as_utf16le(&target_path, bom.unwrap_or(false))?;
        return Ok(CsvMacroResult {
            output_path: target_path,
            applied,
        });
    }

    rewrite_with_utf8_bom(&target_path, bom.unwrap_or(false))?;
    Ok(CsvMacroResult {
        output_path: target_path,
        applied,
    })
}

#[tauri::command]
fn compute_column_stats(
    path: String,
    delimiter: String,
    max_distinct: Option<usize>,
) -> Result<Vec<ColumnStat>, String> {
    let delimiter_byte = parse_delimiter(&delimiter);
    let max_distinct = max_distinct.unwrap_or(5000);

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .from_reader(BufReader::new(File::open(&path).map_err(|e| e.to_string())?));

    let headers = reader
        .headers()
        .map(|h| h.iter().map(|s| s.to_string()).collect::<Vec<_>>())
        .map_err(|e| e.to_string())?;

    struct StatInternal {
        non_empty: usize,
        number_count: usize,
        distinct: HashSet<String>,
        distinct_truncated: bool,
    }

    let mut stats: Vec<StatInternal> = headers
        .iter()
        .map(|_| StatInternal {
            non_empty: 0,
            number_count: 0,
            distinct: HashSet::new(),
            distinct_truncated: false,
        })
        .collect();

    for record in reader.records() {
        let record = record.map_err(|e| e.to_string())?;
        for (idx, value) in record.iter().enumerate() {
            if idx >= stats.len() {
                continue;
            }
            let value = value.trim();
            if value.is_empty() {
                continue;
            }
            let stat = &mut stats[idx];
            stat.non_empty += 1;
            if value.parse::<f64>().is_ok() {
                stat.number_count += 1;
            }
            if !stat.distinct_truncated {
                if stat.distinct.len() < max_distinct {
                    stat.distinct.insert(value.to_string());
                } else {
                    stat.distinct_truncated = true;
                }
            }
        }
    }

    let results = headers
        .into_iter()
        .enumerate()
        .map(|(idx, name)| {
            let stat = &stats[idx];
            let inferred = if stat.non_empty > 0 && stat.number_count == stat.non_empty {
                "number"
            } else {
                "text"
            };
            ColumnStat {
                name,
                non_empty: stat.non_empty,
                distinct: stat.distinct.len(),
                distinct_truncated: stat.distinct_truncated,
                inferred: inferred.to_string(),
            }
        })
        .collect();

    Ok(results)
}

#[tauri::command]
fn apply_find_replace_to_file(
    path: String,
    target_path: String,
    delimiter: String,
    spec: FindReplaceSpec,
    eol: Option<String>,
    bom: Option<bool>,
    encoding: Option<String>,
    quote: Option<String>,
    escape: Option<String>,
) -> Result<FindReplaceResult, String> {
    let delimiter_byte = parse_delimiter(&delimiter);
    let eol_bytes = normalize_terminator(eol);
    let quote_byte = quote
        .as_deref()
        .and_then(|q| q.as_bytes().first().copied())
        .unwrap_or(b'"');
    let escape_byte = escape
        .as_deref()
        .and_then(|q| q.as_bytes().first().copied())
        .unwrap_or(b'"');

    let encoding = encoding.unwrap_or_else(|| "UTF-8".to_string());
    let use_utf16 = encoding.eq_ignore_ascii_case("UTF-16LE");

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .from_reader(BufReader::new(File::open(&path).map_err(|e| e.to_string())?));

    let headers = reader
        .headers()
        .map(|h| h.iter().map(|s| s.to_string()).collect::<Vec<_>>())
        .map_err(|e| e.to_string())?;

    let mut writer = csv::WriterBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .terminator(eol_bytes)
        .quote(quote_byte)
        .escape(escape_byte)
        .from_path(&target_path)
        .map_err(|e| e.to_string())?;

    writer.write_record(&headers).map_err(|e| e.to_string())?;

    let mut applied = 0usize;
    let regex = if spec.regex {
        let flags = if spec.match_case { "g" } else { "gi" };
        let pattern = format!("(?{}){}", flags, spec.find);
        regex::Regex::new(&pattern).map_err(|e| e.to_string())?
    } else {
        regex::Regex::new("$")
            .map_err(|e| e.to_string())?
    };

    for record in reader.records() {
        let record = record.map_err(|e| e.to_string())?;
        let mut row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
        let columns: Vec<usize> = match spec.column {
            Some(col) => vec![col],
            None => (0..row.len()).collect(),
        };
        for col in columns {
            if col >= row.len() {
                continue;
            }
            let current = row[col].clone();
            let next = if spec.regex {
                regex.replace_all(&current, spec.replace.as_str()).to_string()
            } else if spec.match_case {
                current.replace(&spec.find, &spec.replace)
            } else {
                let escaped = regex::escape(&spec.find);
                let ci = regex::RegexBuilder::new(&escaped)
                    .case_insensitive(true)
                    .build()
                    .map_err(|e| e.to_string())?;
                ci.replace_all(&current, spec.replace.as_str()).to_string()
            };
            if next != current {
                row[col] = next;
                applied += 1;
            }
        }
        writer.write_record(&row).map_err(|e| e.to_string())?;
    }

    writer.flush().map_err(|e| e.to_string())?;
    if use_utf16 {
        rewrite_as_utf16le(&target_path, bom.unwrap_or(false))?;
        return Ok(FindReplaceResult {
            output_path: target_path,
            applied,
        });
    }

    rewrite_with_utf8_bom(&target_path, bom.unwrap_or(false))?;
    Ok(FindReplaceResult {
        output_path: target_path,
        applied,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            preview_csv,
            open_csv_session,
            read_csv_rows,
            close_csv_session,
            save_csv_with_patches,
            apply_macro_to_file,
            compute_column_stats,
            apply_find_replace_to_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
