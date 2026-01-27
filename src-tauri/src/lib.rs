use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{BufReader, Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::sync::OnceLock;
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
#[cfg(desktop)]
use tauri::Manager;
use tauri::Emitter;

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

#[cfg(desktop)]
fn is_zh(locale: &str) -> bool {
    locale.to_lowercase().starts_with("zh")
}

#[cfg(desktop)]
fn build_app_menu<R: tauri::Runtime, M: Manager<R>>(
    manager: &M,
    locale: &str,
) -> tauri::Result<Menu<R>> {
    let zh = is_zh(locale);
    let file_open = MenuItemBuilder::with_id("file_open", if zh { "打开..." } else { "Open..." })
        .accelerator("CmdOrCtrl+O")
        .build(manager)?;
    let file_save_as = MenuItemBuilder::with_id("file_save_as", if zh { "另存为..." } else { "Save As..." })
        .accelerator("CmdOrCtrl+Shift+S")
        .build(manager)?;
    let file_macro = MenuItemBuilder::with_id("file_macro", if zh { "运行宏(文件)" } else { "Run Macro (file)" })
        .accelerator("CmdOrCtrl+Shift+M")
        .build(manager)?;
    let file_find_replace = MenuItemBuilder::with_id(
        "file_find_replace",
        if zh { "查找/替换(文件)" } else { "Find/Replace (file)" },
    )
        .accelerator("CmdOrCtrl+Shift+F")
        .build(manager)?;
    let app_quit = MenuItemBuilder::with_id("app_quit", if zh { "退出" } else { "Quit" })
        .accelerator("CmdOrCtrl+Q")
        .build(manager)?;

    let edit_undo = MenuItemBuilder::with_id("edit_undo", if zh { "撤销" } else { "Undo" })
        .accelerator("CmdOrCtrl+Z")
        .build(manager)?;
    let edit_redo = MenuItemBuilder::with_id("edit_redo", if zh { "重做" } else { "Redo" })
        .accelerator("CmdOrCtrl+Shift+Z")
        .build(manager)?;
    let edit_clear = MenuItemBuilder::with_id("edit_clear", if zh { "清除编辑" } else { "Clear Edits" })
        .accelerator("CmdOrCtrl+Shift+X")
        .build(manager)?;

    let view_load_more = MenuItemBuilder::with_id("view_load_more", if zh { "加载更多行" } else { "Load more rows" })
        .accelerator("CmdOrCtrl+L")
        .build(manager)?;
    let view_stats = MenuItemBuilder::with_id(
        "view_stats",
        if zh { "列统计(全量)" } else { "Column stats (full)" },
    )
        .accelerator("CmdOrCtrl+Shift+T")
        .build(manager)?;
    let view_toggle_quickbar =
        MenuItemBuilder::with_id("view_toggle_quickbar", if zh { "切换快捷栏" } else { "Toggle quickbar" })
            .accelerator("CmdOrCtrl+1")
            .build(manager)?;
    let view_toggle_findbar =
        MenuItemBuilder::with_id("view_toggle_findbar", if zh { "切换查找栏" } else { "Toggle find bar" })
            .accelerator("CmdOrCtrl+2")
            .build(manager)?;
    let view_toggle_macro =
        MenuItemBuilder::with_id("view_toggle_macro", if zh { "切换宏面板" } else { "Toggle macro panel" })
            .accelerator("CmdOrCtrl+3")
            .build(manager)?;
    let view_toggle_ops = MenuItemBuilder::with_id(
        "view_toggle_ops",
        if zh { "切换列/排序/筛选面板" } else { "Toggle column/sort/filter panel" },
    )
    .accelerator("CmdOrCtrl+4")
    .build(manager)?;
    let view_toggle_export =
        MenuItemBuilder::with_id("view_toggle_export", if zh { "切换导出选项" } else { "Toggle export options" })
            .accelerator("CmdOrCtrl+5")
            .build(manager)?;
    let view_toggle_find_panel =
        MenuItemBuilder::with_id("view_toggle_find_panel", if zh { "切换查找/替换面板" } else { "Toggle find/replace panel" })
            .accelerator("CmdOrCtrl+6")
            .build(manager)?;
    let view_toggle_stats_panel =
        MenuItemBuilder::with_id("view_toggle_stats_panel", if zh { "切换统计面板" } else { "Toggle stats panel" })
            .accelerator("CmdOrCtrl+7")
            .build(manager)?;

    let tools_find_loaded =
        MenuItemBuilder::with_id("tools_find_loaded", if zh { "查找/替换(已加载)" } else { "Find/Replace (loaded)" })
            .accelerator("CmdOrCtrl+F")
            .build(manager)?;
    let tools_macro_loaded = MenuItemBuilder::with_id("tools_macro_loaded", if zh { "宏(已加载)" } else { "Macro (loaded)" })
        .accelerator("CmdOrCtrl+M")
        .build(manager)?;

    let help_about = MenuItemBuilder::with_id("help_about", if zh { "关于 nmeditor" } else { "About nmeditor" })
        .build(manager)?;

    let file_menu = SubmenuBuilder::new(manager, if zh { "文件" } else { "File" })
        .item(&file_open)
        .item(&file_save_as)
        .separator()
        .item(&file_macro)
        .item(&file_find_replace)
        .separator()
        .item(&app_quit)
        .build()?;

    let edit_menu = SubmenuBuilder::new(manager, if zh { "编辑" } else { "Edit" })
        .item(&edit_undo)
        .item(&edit_redo)
        .separator()
        .item(&edit_clear)
        .build()?;

    let view_menu = SubmenuBuilder::new(manager, if zh { "视图" } else { "View" })
        .item(&view_load_more)
        .item(&view_stats)
        .separator()
        .item(&view_toggle_quickbar)
        .item(&view_toggle_findbar)
        .item(&view_toggle_macro)
        .item(&view_toggle_ops)
        .item(&view_toggle_export)
        .item(&view_toggle_find_panel)
        .item(&view_toggle_stats_panel)
        .build()?;

    let tools_menu = SubmenuBuilder::new(manager, if zh { "工具" } else { "Tools" })
        .item(&tools_find_loaded)
        .item(&tools_macro_loaded)
        .build()?;

    let help_menu = SubmenuBuilder::new(manager, if zh { "帮助" } else { "Help" })
        .item(&help_about)
        .build()?;

    let menu = Menu::new(manager)?;
    menu.append(&file_menu)?;
    menu.append(&edit_menu)?;
    menu.append(&view_menu)?;
    menu.append(&tools_menu)?;
    menu.append(&help_menu)?;
    Ok(menu)
}

#[tauri::command]
fn set_menu_locale(app: tauri::AppHandle, locale: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let menu = build_app_menu(&app, &locale).map_err(|e| e.to_string())?;
        app.set_menu(menu).map_err(|e| e.to_string())?;
    }
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

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum RowOp {
    #[serde(rename = "insert")]
    Insert { index: usize, values: Vec<String> },
    #[serde(rename = "delete")]
    Delete { index: usize },
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum ColumnOp {
    #[serde(rename = "insert")]
    Insert { index: usize, name: String },
    #[serde(rename = "delete")]
    Delete { index: usize },
    #[serde(rename = "rename")]
    Rename { index: usize, name: String },
}

#[derive(Clone)]
struct NormalizedRowOp {
    input_index: isize,
    op: RowOp,
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

static MENU_EVENT_GUARD: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();

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
fn read_csv_rows_window(
    path: String,
    delimiter: Option<String>,
    start: usize,
    limit: usize,
) -> Result<CsvSlice, String> {
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

    let _ = reader.headers().map_err(|e| e.to_string())?;

    let mut rows = Vec::new();
    let mut current = 0usize;
    for rec in reader.records() {
        let record = rec.map_err(|e| e.to_string())?;
        if current >= start {
            rows.push(record.iter().map(|s| s.to_string()).collect());
            if rows.len() >= limit {
                break;
            }
        }
        current += 1;
    }

    let eof = rows.len() < limit;
    let end = start + rows.len();

    Ok(CsvSlice {
        rows,
        start,
        end,
        eof,
    })
}

#[tauri::command]
fn count_csv_rows(path: String, delimiter: Option<String>) -> Result<usize, String> {
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

    let _ = reader.headers().map_err(|e| e.to_string())?;

    let mut count = 0usize;
    for rec in reader.records() {
        rec.map_err(|e| e.to_string())?;
        count += 1;
    }

    Ok(count)
}

#[tauri::command]
fn close_csv_session(state: tauri::State<AppState>, session_id: u64) -> Result<bool, String> {
    let mut sessions = state.sessions.lock().map_err(|_| "lock poisoned")?;
    Ok(sessions.remove(&session_id).is_some())
}

fn normalize_row_ops(ops: &[RowOp]) -> Vec<NormalizedRowOp> {
    let mut normalized = Vec::new();
    let mut offset: isize = 0;
    for op in ops {
        match op {
            RowOp::Insert { index, .. } => {
                let input_index = (*index as isize - offset).max(0);
                normalized.push(NormalizedRowOp {
                    input_index,
                    op: op.clone(),
                });
                offset += 1;
            }
            RowOp::Delete { index } => {
                let input_index = (*index as isize - offset).max(0);
                normalized.push(NormalizedRowOp {
                    input_index,
                    op: op.clone(),
                });
                offset -= 1;
            }
        }
    }
    normalized
}

fn apply_column_ops_to_headers(headers: &mut Vec<String>, column_ops: &[ColumnOp]) {
    for op in column_ops {
        match op {
            ColumnOp::Insert { index, name } => {
                let idx = (*index).min(headers.len());
                headers.insert(idx, name.clone());
            }
            ColumnOp::Delete { index } => {
                if *index < headers.len() {
                    headers.remove(*index);
                }
            }
            ColumnOp::Rename { index, name } => {
                if *index < headers.len() {
                    headers[*index] = name.clone();
                }
            }
        }
    }
}

fn apply_column_ops_to_row(row: &mut Vec<String>, column_ops: &[ColumnOp]) {
    for op in column_ops {
        match op {
            ColumnOp::Insert { index, .. } => {
                let idx = (*index).min(row.len());
                row.insert(idx, String::new());
            }
            ColumnOp::Delete { index } => {
                if *index < row.len() {
                    row.remove(*index);
                }
            }
            ColumnOp::Rename { .. } => {}
        }
    }
}

#[tauri::command]
fn save_csv_with_patches(
    path: String,
    target_path: String,
    delimiter: String,
    patches: Vec<CsvPatch>,
    row_ops: Vec<RowOp>,
    column_ops: Vec<ColumnOp>,
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

    let mut headers = reader
        .headers()
        .map(|h| h.iter().map(|s| s.to_string()).collect::<Vec<_>>())
        .map_err(|e| e.to_string())?;

    apply_column_ops_to_headers(&mut headers, &column_ops);

    let mut writer = csv::WriterBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .terminator(eol_bytes)
        .quote(quote_byte)
        .escape(escape_byte)
        .from_path(&target_path)
        .map_err(|e| e.to_string())?;

    writer.write_record(&headers).map_err(|e| e.to_string())?;

    let normalized_ops = normalize_row_ops(&row_ops);
    let mut op_index = 0usize;
    let mut output_index = 0usize;
    let mut input_index = 0usize;

    for record in reader.records() {
        let record = record.map_err(|e| e.to_string())?;
        let mut skip_current = false;

        while op_index < normalized_ops.len()
            && normalized_ops[op_index].input_index == input_index as isize
        {
            match &normalized_ops[op_index].op {
                RowOp::Insert { values, .. } => {
                    let mut row = values.clone();
                    apply_column_ops_to_row(&mut row, &column_ops);
                    if let Some(row_patches) = patch_map.get(&output_index) {
                        for (col_idx, value) in row_patches {
                            if *col_idx >= row.len() {
                                row.resize(col_idx + 1, String::new());
                            }
                            row[*col_idx] = value.clone();
                        }
                    }
                    writer.write_record(&row).map_err(|e| e.to_string())?;
                    output_index += 1;
                }
                RowOp::Delete { .. } => {
                    skip_current = true;
                }
            }
            op_index += 1;
        }

        if skip_current {
            input_index += 1;
            continue;
        }

        let mut row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
        apply_column_ops_to_row(&mut row, &column_ops);
        if let Some(row_patches) = patch_map.get(&output_index) {
            for (col_idx, value) in row_patches {
                if *col_idx >= row.len() {
                    row.resize(col_idx + 1, String::new());
                }
                row[*col_idx] = value.clone();
            }
        }
        writer.write_record(&row).map_err(|e| e.to_string())?;
        output_index += 1;
        input_index += 1;
    }

    while op_index < normalized_ops.len() {
        if let RowOp::Insert { values, .. } = &normalized_ops[op_index].op {
            let mut row = values.clone();
            apply_column_ops_to_row(&mut row, &column_ops);
            if let Some(row_patches) = patch_map.get(&output_index) {
                for (col_idx, value) in row_patches {
                    if *col_idx >= row.len() {
                        row.resize(col_idx + 1, String::new());
                    }
                    row[*col_idx] = value.clone();
                }
            }
            writer.write_record(&row).map_err(|e| e.to_string())?;
            output_index += 1;
        }
        op_index += 1;
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
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                let menu = build_app_menu(app, "en")?;
                app.set_menu(menu)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            preview_csv,
            open_csv_session,
            read_csv_rows,
            read_csv_rows_window,
            count_csv_rows,
            close_csv_session,
            save_csv_with_patches,
            apply_macro_to_file,
            compute_column_stats,
            apply_find_replace_to_file,
            set_menu_locale
        ])
        .on_menu_event(|app, event| {
            if event.id() == "app_quit" {
                app.exit(0);
                return;
            }
            let guard = MENU_EVENT_GUARD.get_or_init(|| Mutex::new(HashMap::new()));
            let now = Instant::now();
            let should_emit = {
                let mut map = guard.lock().unwrap_or_else(|e| e.into_inner());
                let id = event.id().as_ref().to_string();
                if let Some(last) = map.get(&id) {
                    if now.duration_since(*last) < Duration::from_millis(300) {
                        false
                    } else {
                        map.insert(id, now);
                        true
                    }
                } else {
                    map.insert(id, now);
                    true
                }
            };
            if should_emit {
                let _ = app.emit("menu-event", event.id().as_ref());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
