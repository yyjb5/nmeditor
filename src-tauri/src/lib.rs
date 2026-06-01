use encoding_rs::{GBK, SHIFT_JIS};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering as CmpOrdering;
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufReader, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::OnceLock;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;
#[cfg(desktop)]
use tauri::Manager;

/// Choose delimiter from user input; supports "\t" for tabs and falls back to comma.
fn parse_delimiter(input: &str) -> u8 {
    if input == "\\t" {
        b'\t'
    } else {
        input.as_bytes().first().copied().unwrap_or(b',')
    }
}

fn delimiter_to_string(delimiter: u8) -> String {
    match delimiter {
        b'\t' => "\\t".to_string(),
        other => String::from_utf8_lossy(&[other]).to_string(),
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
    file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| e.to_string())?;
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
    let file_save = MenuItemBuilder::with_id("file_save", if zh { "保存" } else { "Save" })
        .accelerator("CmdOrCtrl+S")
        .build(manager)?;
    let file_save_as =
        MenuItemBuilder::with_id("file_save_as", if zh { "另存为..." } else { "Save As..." })
            .accelerator("CmdOrCtrl+Shift+S")
            .build(manager)?;
    let file_macro = MenuItemBuilder::with_id(
        "file_macro",
        if zh {
            "运行宏(文件)"
        } else {
            "Run Macro (file)"
        },
    )
    .accelerator("CmdOrCtrl+Shift+M")
    .build(manager)?;
    let file_find_replace = MenuItemBuilder::with_id(
        "file_find_replace",
        if zh {
            "查找/替换(文件)"
        } else {
            "Find/Replace (file)"
        },
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
    let edit_clear =
        MenuItemBuilder::with_id("edit_clear", if zh { "清除编辑" } else { "Clear Edits" })
            .accelerator("CmdOrCtrl+Shift+X")
            .build(manager)?;

    let view_load_more = MenuItemBuilder::with_id(
        "view_load_more",
        if zh {
            "加载更多行"
        } else {
            "Load more rows"
        },
    )
    .accelerator("CmdOrCtrl+L")
    .build(manager)?;
    let view_stats = MenuItemBuilder::with_id(
        "view_stats",
        if zh {
            "列统计(全量)"
        } else {
            "Column stats (full)"
        },
    )
    .accelerator("CmdOrCtrl+Shift+T")
    .build(manager)?;
    let view_toggle_quickbar = MenuItemBuilder::with_id(
        "view_toggle_quickbar",
        if zh {
            "切换快捷栏"
        } else {
            "Toggle quickbar"
        },
    )
    .accelerator("CmdOrCtrl+1")
    .build(manager)?;
    let view_toggle_findbar = MenuItemBuilder::with_id(
        "view_toggle_findbar",
        if zh {
            "切换查找栏"
        } else {
            "Toggle find bar"
        },
    )
    .accelerator("CmdOrCtrl+2")
    .build(manager)?;
    let view_toggle_macro = MenuItemBuilder::with_id(
        "view_toggle_macro",
        if zh {
            "切换宏面板"
        } else {
            "Toggle macro panel"
        },
    )
    .accelerator("CmdOrCtrl+3")
    .build(manager)?;
    let view_toggle_ops = MenuItemBuilder::with_id(
        "view_toggle_ops",
        if zh {
            "切换列/排序/筛选面板"
        } else {
            "Toggle column/sort/filter panel"
        },
    )
    .accelerator("CmdOrCtrl+4")
    .build(manager)?;
    let view_toggle_export = MenuItemBuilder::with_id(
        "view_toggle_export",
        if zh {
            "切换导出选项"
        } else {
            "Toggle export options"
        },
    )
    .accelerator("CmdOrCtrl+5")
    .build(manager)?;
    let view_toggle_find_panel = MenuItemBuilder::with_id(
        "view_toggle_find_panel",
        if zh {
            "切换查找/替换面板"
        } else {
            "Toggle find/replace panel"
        },
    )
    .accelerator("CmdOrCtrl+6")
    .build(manager)?;
    let view_toggle_stats_panel = MenuItemBuilder::with_id(
        "view_toggle_stats_panel",
        if zh {
            "切换统计面板"
        } else {
            "Toggle stats panel"
        },
    )
    .accelerator("CmdOrCtrl+7")
    .build(manager)?;

    let tools_find_loaded = MenuItemBuilder::with_id(
        "tools_find_loaded",
        if zh {
            "查找/替换(已加载)"
        } else {
            "Find/Replace (loaded)"
        },
    )
    .accelerator("CmdOrCtrl+F")
    .build(manager)?;
    let tools_macro_loaded = MenuItemBuilder::with_id(
        "tools_macro_loaded",
        if zh {
            "宏(已加载)"
        } else {
            "Macro (loaded)"
        },
    )
    .accelerator("CmdOrCtrl+M")
    .build(manager)?;

    let help_about = MenuItemBuilder::with_id(
        "help_about",
        if zh {
            "关于 nmeditor"
        } else {
            "About nmeditor"
        },
    )
    .build(manager)?;

    let file_menu = SubmenuBuilder::new(manager, if zh { "文件" } else { "File" })
        .item(&file_open)
        .item(&file_save)
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
    pub row_indices: Option<Vec<usize>>,
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
    #[serde(rename = "duplicate")]
    Duplicate {
        index: usize,
        from: usize,
        name: String,
    },
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

#[derive(Clone, Serialize, Deserialize)]
pub struct FindMatchEntry {
    pub row: usize,
    pub col: usize,
    pub value: String,
}

#[derive(Serialize, Deserialize)]
pub struct FindMatchesResult {
    pub matches: Vec<FindMatchEntry>,
    pub has_more: bool,
    pub scanned_rows: usize,
    pub elapsed_ms: u64,
}

#[derive(Serialize, Deserialize)]
pub struct SortRule {
    pub column: usize,
    pub direction: String,
}

#[derive(Serialize, Deserialize)]
pub struct FilterRule {
    pub column: usize,
    pub value: String,
}

#[derive(Serialize, Deserialize)]
pub struct GlobalViewResponse {
    pub view_id: u64,
    pub total_rows: usize,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ColumnValueCount {
    pub value: String,
    pub count: usize,
}

#[derive(Serialize, Deserialize)]
pub struct ColumnValueCountsResult {
    pub values: Vec<ColumnValueCount>,
    pub has_more: bool,
    pub truncated: bool,
    pub scanned_rows: usize,
}

#[derive(Clone)]
struct SortKeyItem {
    text: String,
    num: Option<f64>,
    desc: bool,
}

#[derive(Clone)]
struct SortKey {
    items: Vec<SortKeyItem>,
}

impl PartialEq for SortKey {
    fn eq(&self, other: &Self) -> bool {
        self.cmp(other) == CmpOrdering::Equal
    }
}

impl Eq for SortKey {}

impl PartialOrd for SortKey {
    fn partial_cmp(&self, other: &Self) -> Option<CmpOrdering> {
        Some(self.cmp(other))
    }
}

impl Ord for SortKey {
    fn cmp(&self, other: &Self) -> CmpOrdering {
        let len = self.items.len().min(other.items.len());
        for idx in 0..len {
            let a = &self.items[idx];
            let b = &other.items[idx];
            let base = match (a.num, b.num) {
                (Some(a_num), Some(b_num)) => {
                    a_num.partial_cmp(&b_num).unwrap_or(CmpOrdering::Equal)
                }
                _ => a.text.cmp(&b.text),
            };
            if base != CmpOrdering::Equal {
                return if a.desc { base.reverse() } else { base };
            }
        }
        self.items.len().cmp(&other.items.len())
    }
}

struct CsvSession {
    reader: csv::Reader<BufReader<File>>,
    row_index: usize,
    eof: bool,
}

#[derive(Clone)]
struct CsvIndexEntry {
    row: usize,
    byte: u64,
}

#[derive(Clone)]
struct CsvIndex {
    data_start: u64,
    offsets: Vec<CsvIndexEntry>,
    file_len: u64,
    modified: u64,
    total_rows: usize,
}

#[derive(Clone)]
enum GlobalViewMode {
    TempFile(String),
}

#[derive(Clone)]
struct GlobalView {
    mode: GlobalViewMode,
    delimiter: u8,
    index_key: Option<String>,
}

struct AppState {
    sessions: Mutex<HashMap<u64, CsvSession>>,
    next_id: AtomicU64,
    indexes: Arc<Mutex<HashMap<String, Arc<CsvIndex>>>>,
    index_jobs: Arc<Mutex<HashMap<u64, IndexJob>>>,
    next_index_job: AtomicU64,
    find_jobs: Arc<Mutex<HashMap<u64, FindJob>>>,
    next_find_job: AtomicU64,
    views: Mutex<HashMap<u64, GlobalView>>,
    next_view_id: AtomicU64,
}

#[derive(Serialize, Deserialize)]
struct StartIndexResponse {
    job_id: u64,
    done: bool,
    total_rows: Option<usize>,
}

#[derive(Serialize, Deserialize)]
struct IndexJobStatus {
    job_id: u64,
    progress: f32,
    done: bool,
    canceled: bool,
    total_rows: Option<usize>,
}

struct IndexJob {
    progress: f32,
    done: bool,
    canceled: bool,
    total_rows: Option<usize>,
    cancel_flag: Arc<AtomicBool>,
}

#[derive(Serialize, Deserialize)]
struct StartFindMatchesResponse {
    job_id: u64,
    done: bool,
}

#[derive(Serialize, Deserialize)]
struct FindMatchesJobStatus {
    job_id: u64,
    progress: f32,
    done: bool,
    canceled: bool,
    has_more: bool,
    matched_count: usize,
    scanned_rows: usize,
    elapsed_ms: u64,
    matches: Option<Vec<FindMatchEntry>>,
    matches_offset: Option<usize>,
    matches_total: Option<usize>,
    error: Option<String>,
}

struct FindJob {
    progress: f32,
    done: bool,
    canceled: bool,
    has_more: bool,
    matched_count: usize,
    scanned_rows: usize,
    elapsed_ms: u64,
    matches: Vec<FindMatchEntry>,
    error: Option<String>,
    cancel_flag: Arc<AtomicBool>,
}

static MENU_EVENT_GUARD: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();

const INDEX_STRIDE: usize = 1000;
const MAX_INDEX_CACHE_ENTRIES: usize = 12;
const MAX_GLOBAL_VIEW_ENTRIES: usize = 6;
const MAX_INDEX_JOB_ENTRIES: usize = 64;
const MAX_FIND_JOB_ENTRIES: usize = 64;

fn index_key(path: &str, delimiter: u8) -> String {
    format!("{}::{}", path, delimiter)
}

fn prune_index_cache(indexes: &mut HashMap<String, Arc<CsvIndex>>) {
    if indexes.len() <= MAX_INDEX_CACHE_ENTRIES {
        return;
    }
    let remove_count = indexes.len() - MAX_INDEX_CACHE_ENTRIES;
    let mut keys: Vec<(String, u64)> = indexes
        .iter()
        .map(|(key, value)| (key.clone(), value.modified))
        .collect();
    keys.sort_by_key(|(_, modified)| *modified);
    for (key, _) in keys.into_iter().take(remove_count) {
        indexes.remove(&key);
    }
}

fn prune_index_jobs(jobs: &mut HashMap<u64, IndexJob>) {
    jobs.retain(|_, job| !job.done);
    if jobs.len() <= MAX_INDEX_JOB_ENTRIES {
        return;
    }
    let mut ids: Vec<u64> = jobs.keys().copied().collect();
    ids.sort_unstable();
    let remove_count = jobs.len() - MAX_INDEX_JOB_ENTRIES;
    for id in ids.into_iter().take(remove_count) {
        jobs.remove(&id);
    }
}

fn prune_find_jobs(jobs: &mut HashMap<u64, FindJob>) {
    jobs.retain(|_, job| !job.done);
    if jobs.len() <= MAX_FIND_JOB_ENTRIES {
        return;
    }
    let mut ids: Vec<u64> = jobs.keys().copied().collect();
    ids.sort_unstable();
    let remove_count = jobs.len() - MAX_FIND_JOB_ENTRIES;
    for id in ids.into_iter().take(remove_count) {
        jobs.remove(&id);
    }
}

fn file_signature(path: &PathBuf) -> Result<(u64, u64), String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or_else(|| {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        });
    Ok((metadata.len(), modified))
}

fn update_index_job(
    jobs: &Arc<Mutex<HashMap<u64, IndexJob>>>,
    job_id: u64,
    update: impl FnOnce(&mut IndexJob),
) {
    if let Ok(mut map) = jobs.lock() {
        if let Some(job) = map.get_mut(&job_id) {
            update(job);
        }
    }
}

fn is_job_canceled(jobs: &Arc<Mutex<HashMap<u64, IndexJob>>>, job_id: u64) -> bool {
    if let Ok(map) = jobs.lock() {
        if let Some(job) = map.get(&job_id) {
            return job.cancel_flag.load(Ordering::Relaxed);
        }
    }
    false
}

#[tauri::command]
fn start_prepare_csv_index(
    state: tauri::State<AppState>,
    path: String,
    delimiter: Option<String>,
) -> Result<StartIndexResponse, String> {
    let path_buf = PathBuf::from(&path);

    let delimiter_byte = if let Some(value) = delimiter.as_deref() {
        parse_delimiter(value)
    } else {
        let mut sample = String::new();
        let sample_reader = BufReader::new(File::open(&path_buf).map_err(|e| e.to_string())?);
        sample_reader
            .take(64 * 1024)
            .read_to_string(&mut sample)
            .map_err(|e| e.to_string())?;
        detect_delimiter(&sample)
    };

    let signature = file_signature(&path_buf)?;
    let key = index_key(&path, delimiter_byte);
    if let Ok(indexes) = state.indexes.lock() {
        if let Some(existing) = indexes.get(&key) {
            if existing.file_len == signature.0 && existing.modified == signature.1 {
                return Ok(StartIndexResponse {
                    job_id: 0,
                    done: true,
                    total_rows: Some(existing.total_rows),
                });
            }
        }
    }

    let job_id = state.next_index_job.fetch_add(1, Ordering::Relaxed);
    let cancel_flag = Arc::new(AtomicBool::new(false));

    {
        let mut jobs = state.index_jobs.lock().map_err(|_| "lock poisoned")?;
        prune_index_jobs(&mut jobs);
        jobs.insert(
            job_id,
            IndexJob {
                progress: 0.0,
                done: false,
                canceled: false,
                total_rows: None,
                cancel_flag: cancel_flag.clone(),
            },
        );
    }

    let jobs = state.index_jobs.clone();
    let indexes = state.indexes.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| -> Result<CsvIndex, String> {
            let (file_len, modified) = file_signature(&path_buf)?;
            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .delimiter(delimiter_byte)
                .from_reader(BufReader::new(
                    File::open(&path_buf).map_err(|e| e.to_string())?,
                ));

            let _ = reader.headers().map_err(|e| e.to_string())?;
            let mut offsets = Vec::new();
            let mut record = csv::StringRecord::new();
            let mut row_index = 0usize;
            let mut last_pos = reader.position().byte();
            let data_start = last_pos;
            let mut last_progress = 0.0f32;

            loop {
                if is_job_canceled(&jobs, job_id) {
                    return Err("canceled".to_string());
                }
                if !reader.read_record(&mut record).map_err(|e| e.to_string())? {
                    break;
                }
                let record_start = last_pos;
                if row_index % INDEX_STRIDE == 0 {
                    offsets.push(CsvIndexEntry {
                        row: row_index,
                        byte: record_start,
                    });
                }
                row_index += 1;
                last_pos = reader.position().byte();

                if row_index % INDEX_STRIDE == 0 {
                    let progress = if file_len > 0 {
                        (last_pos as f32 / file_len as f32).min(1.0)
                    } else {
                        0.0
                    };
                    if progress - last_progress >= 0.01 {
                        last_progress = progress;
                        update_index_job(&jobs, job_id, |job| {
                            job.progress = progress;
                        });
                    }
                }
            }

            Ok(CsvIndex {
                data_start,
                offsets,
                file_len,
                modified,
                total_rows: row_index,
            })
        })();

        match result {
            Ok(index) => {
                if let Ok(mut map) = indexes.lock() {
                    let key = index_key(&path, delimiter_byte);
                    map.insert(key, Arc::new(index.clone()));
                    prune_index_cache(&mut map);
                }
                update_index_job(&jobs, job_id, |job| {
                    job.done = true;
                    job.progress = 1.0;
                    job.total_rows = Some(index.total_rows);
                });
            }
            Err(err) => {
                if err == "canceled" {
                    update_index_job(&jobs, job_id, |job| {
                        job.done = true;
                        job.canceled = true;
                    });
                } else {
                    update_index_job(&jobs, job_id, |job| {
                        job.done = true;
                    });
                }
            }
        }
    });

    Ok(StartIndexResponse {
        job_id,
        done: false,
        total_rows: None,
    })
}

#[tauri::command]
fn get_prepare_csv_index_status(
    state: tauri::State<AppState>,
    job_id: u64,
) -> Result<IndexJobStatus, String> {
    let mut jobs = state.index_jobs.lock().map_err(|_| "lock poisoned")?;
    let job = jobs
        .get(&job_id)
        .ok_or_else(|| "job not found".to_string())?;
    let status = IndexJobStatus {
        job_id,
        progress: job.progress,
        done: job.done,
        canceled: job.canceled,
        total_rows: job.total_rows,
    };
    if status.done {
        jobs.remove(&job_id);
    }
    Ok(status)
}

fn update_find_job(
    jobs: &Arc<Mutex<HashMap<u64, FindJob>>>,
    job_id: u64,
    update: impl FnOnce(&mut FindJob),
) {
    if let Ok(mut map) = jobs.lock() {
        if let Some(job) = map.get_mut(&job_id) {
            update(job);
        }
    }
}

fn is_find_job_canceled(jobs: &Arc<Mutex<HashMap<u64, FindJob>>>, job_id: u64) -> bool {
    if let Ok(map) = jobs.lock() {
        if let Some(job) = map.get(&job_id) {
            return job.cancel_flag.load(Ordering::Relaxed);
        }
    }
    false
}

fn bytes_match_at(haystack: &[u8], needle: &[u8], start: usize, match_case: bool) -> bool {
    if start + needle.len() > haystack.len() {
        return false;
    }
    if match_case {
        return &haystack[start..start + needle.len()] == needle;
    }
    for (idx, value) in needle.iter().enumerate() {
        if haystack[start + idx].to_ascii_lowercase() != value.to_ascii_lowercase() {
            return false;
        }
    }
    true
}

fn is_all_upper_ascii(value: &str) -> bool {
    let mut has_letter = false;
    for byte in value.bytes() {
        if byte.is_ascii_alphabetic() {
            has_letter = true;
            if !byte.is_ascii_uppercase() {
                return false;
            }
        }
    }
    has_letter
}

fn is_all_lower_ascii(value: &str) -> bool {
    let mut has_letter = false;
    for byte in value.bytes() {
        if byte.is_ascii_alphabetic() {
            has_letter = true;
            if !byte.is_ascii_lowercase() {
                return false;
            }
        }
    }
    has_letter
}

fn is_title_case_words_ascii(value: &str) -> bool {
    let bytes = value.as_bytes();
    let mut idx = 0usize;
    let mut has_word = false;
    while idx < bytes.len() {
        while idx < bytes.len() && !bytes[idx].is_ascii_alphabetic() {
            idx += 1;
        }
        if idx >= bytes.len() {
            break;
        }
        has_word = true;
        if !bytes[idx].is_ascii_uppercase() {
            return false;
        }
        idx += 1;
        while idx < bytes.len() && bytes[idx].is_ascii_alphabetic() {
            if !bytes[idx].is_ascii_lowercase() {
                return false;
            }
            idx += 1;
        }
    }
    has_word
}

fn to_title_case_words_ascii(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut in_word = false;
    for ch in value.chars() {
        if ch.is_ascii_alphabetic() {
            if in_word {
                out.push(ch.to_ascii_lowercase());
            } else {
                out.push(ch.to_ascii_uppercase());
                in_word = true;
            }
        } else {
            in_word = false;
            out.push(ch);
        }
    }
    out
}

fn apply_replacement_case_pattern(replacement: &str, source: &str) -> String {
    if replacement.is_empty() || source.is_empty() {
        return replacement.to_string();
    }
    if is_all_upper_ascii(source) {
        return replacement.to_ascii_uppercase();
    }
    if is_all_lower_ascii(source) {
        return replacement.to_ascii_lowercase();
    }
    if is_title_case_words_ascii(source) {
        return to_title_case_words_ascii(replacement);
    }
    replacement.to_string()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TextEncodingKind {
    Utf8,
    Utf16Le,
    Gbk,
    ShiftJis,
}

impl TextEncodingKind {
    fn canonical(self) -> &'static str {
        match self {
            TextEncodingKind::Utf8 => "UTF-8",
            TextEncodingKind::Utf16Le => "UTF-16LE",
            TextEncodingKind::Gbk => "GBK",
            TextEncodingKind::ShiftJis => "SHIFT-JIS",
        }
    }
}

fn parse_text_encoding_kind(value: &str) -> Result<TextEncodingKind, String> {
    let normalized = value.trim().to_ascii_uppercase();
    match normalized.as_str() {
        "" | "UTF-8" | "UTF8" => Ok(TextEncodingKind::Utf8),
        "UTF-16LE" | "UTF16LE" => Ok(TextEncodingKind::Utf16Le),
        "GBK" | "CP936" => Ok(TextEncodingKind::Gbk),
        "SHIFT-JIS" | "SHIFT_JIS" | "SJIS" | "CP932" | "WINDOWS-31J" => {
            Ok(TextEncodingKind::ShiftJis)
        }
        _ => Err(format!(
            "Unsupported text encoding: {}. Supported: UTF-8, UTF-16LE, GBK, SHIFT-JIS.",
            value
        )),
    }
}

fn decode_bytes_with_encoding_kind(data: &[u8], encoding: TextEncodingKind) -> String {
    match encoding {
        TextEncodingKind::Utf8 => String::from_utf8_lossy(data).to_string(),
        TextEncodingKind::Utf16Le => decode_utf16le_bytes(data).unwrap_or_default(),
        TextEncodingKind::Gbk => GBK.decode(data).0.into_owned(),
        TextEncodingKind::ShiftJis => SHIFT_JIS.decode(data).0.into_owned(),
    }
}

fn encode_text_with_encoding_kind(text: &str, encoding: TextEncodingKind) -> Result<Vec<u8>, String> {
    match encoding {
        TextEncodingKind::Utf8 => Ok(text.as_bytes().to_vec()),
        TextEncodingKind::Utf16Le => Ok(encode_utf16le_text(text)),
        TextEncodingKind::Gbk => {
            let (encoded, _, had_errors) = GBK.encode(text);
            if had_errors {
                return Err(
                    "Text contains characters that cannot be represented in GBK.".to_string(),
                );
            }
            Ok(encoded.into_owned())
        }
        TextEncodingKind::ShiftJis => {
            let (encoded, _, had_errors) = SHIFT_JIS.encode(text);
            if had_errors {
                return Err(
                    "Text contains characters that cannot be represented in SHIFT-JIS."
                        .to_string(),
                );
            }
            Ok(encoded.into_owned())
        }
    }
}

fn decode_utf16le_bytes(data: &[u8]) -> Option<String> {
    if data.len() % 2 != 0 {
        return None;
    }
    let mut units = Vec::with_capacity(data.len() / 2);
    let mut idx = 0usize;
    while idx + 1 < data.len() {
        units.push(u16::from_le_bytes([data[idx], data[idx + 1]]));
        idx += 2;
    }
    String::from_utf16(&units).ok()
}

fn encode_utf16le_text(text: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(text.len() * 2);
    for unit in text.encode_utf16() {
        out.extend_from_slice(&unit.to_le_bytes());
    }
    out
}

const REPLACE_JOURNAL_FILE_PREFIX: &str = ".deskcsv_replace_journal_";
const REPLACE_JOURNAL_DIR_NAME: &str = "deskcsv_replace_journals";

#[derive(Serialize, Deserialize)]
struct ReplaceJournalRecord {
    version: u8,
    op: String,
    created_at_ms: u64,
    target_path: String,
    temp_path: String,
    backup_path: String,
}

struct ReplaceJournalGuard {
    journal_path: PathBuf,
    record: ReplaceJournalRecord,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u64::MAX as u128) as u64
}

fn replace_journal_dir() -> PathBuf {
    std::env::temp_dir().join(REPLACE_JOURNAL_DIR_NAME)
}

fn create_replace_journal_in_dir(
    journal_dir: &Path,
    target: &Path,
    temp: &Path,
    op: &str,
) -> Result<ReplaceJournalGuard, String> {
    fs::create_dir_all(journal_dir).map_err(|e| e.to_string())?;
    let stamp = now_ms();
    let token = format!("{}_{}", std::process::id(), stamp);
    let backup_path = journal_dir.join(format!(".deskcsv_replace_backup_{}.bak", token));
    fs::copy(target, &backup_path).map_err(|e| e.to_string())?;
    let record = ReplaceJournalRecord {
        version: 1,
        op: op.to_string(),
        created_at_ms: stamp,
        target_path: target.to_string_lossy().to_string(),
        temp_path: temp.to_string_lossy().to_string(),
        backup_path: backup_path.to_string_lossy().to_string(),
    };
    let journal_path = journal_dir.join(format!("{}{}.json", REPLACE_JOURNAL_FILE_PREFIX, token));
    let payload = serde_json::to_vec(&record).map_err(|e| e.to_string())?;
    fs::write(&journal_path, payload).map_err(|e| e.to_string())?;
    Ok(ReplaceJournalGuard {
        journal_path,
        record,
    })
}

fn create_replace_journal(
    target: &Path,
    temp: &Path,
    op: &str,
) -> Result<ReplaceJournalGuard, String> {
    create_replace_journal_in_dir(&replace_journal_dir(), target, temp, op)
}

fn cleanup_replace_journal(guard: &ReplaceJournalGuard) {
    let _ = fs::remove_file(PathBuf::from(&guard.record.temp_path));
    let _ = fs::remove_file(PathBuf::from(&guard.record.backup_path));
    let _ = fs::remove_file(&guard.journal_path);
}

fn restore_target_from_replace_journal(guard: &ReplaceJournalGuard) -> Result<(), String> {
    let target = PathBuf::from(&guard.record.target_path);
    let backup = PathBuf::from(&guard.record.backup_path);
    if !backup.exists() {
        return Ok(());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&backup, &target).map_err(|e| e.to_string())?;
    Ok(())
}

fn recover_pending_replace_journals_in_dir(journal_dir: &Path) -> Result<usize, String> {
    if !journal_dir.exists() {
        return Ok(0);
    }
    let mut recovered = 0usize;
    for entry in fs::read_dir(journal_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !entry.file_type().map_err(|e| e.to_string())?.is_file() {
            continue;
        }
        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if !file_name.starts_with(REPLACE_JOURNAL_FILE_PREFIX) || !file_name.ends_with(".json") {
            continue;
        }
        let raw = fs::read(&path).map_err(|e| e.to_string())?;
        let record: ReplaceJournalRecord = match serde_json::from_slice(&raw) {
            Ok(record) => record,
            Err(_) => {
                let _ = fs::remove_file(path);
                continue;
            }
        };

        let target = PathBuf::from(&record.target_path);
        let temp = PathBuf::from(&record.temp_path);
        let backup = PathBuf::from(&record.backup_path);

        if !target.exists() {
            if backup.exists() {
                if let Some(parent) = target.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                fs::copy(&backup, &target).map_err(|e| e.to_string())?;
                recovered = recovered.saturating_add(1);
            } else if temp.exists() {
                if fs::rename(&temp, &target).is_err() {
                    fs::copy(&temp, &target).map_err(|e| e.to_string())?;
                    let _ = fs::remove_file(&temp);
                }
                recovered = recovered.saturating_add(1);
            }
        }

        let _ = fs::remove_file(temp);
        let _ = fs::remove_file(backup);
        let _ = fs::remove_file(path);
    }
    Ok(recovered)
}

fn recover_pending_replace_journals() -> Result<usize, String> {
    recover_pending_replace_journals_in_dir(&replace_journal_dir())
}

fn scan_text_literal_matches<FIsCanceled, FOnProgress, FOnMatches>(
    path: &str,
    find: &str,
    match_case: bool,
    encoding: &str,
    max_matches: usize,
    mut is_canceled: FIsCanceled,
    mut on_progress: FOnProgress,
    mut on_matches: FOnMatches,
) -> Result<FindMatchesResult, String>
where
    FIsCanceled: FnMut() -> bool,
    FOnProgress: FnMut(f32, usize, usize),
    FOnMatches: FnMut(&[FindMatchEntry]),
{
    if find.is_empty() {
        return Err("Find text is required.".to_string());
    }

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let file_len = file.metadata().map_err(|e| e.to_string())?.len().max(1);
    let mut bom = [0u8; 2];
    let bom_read = file.read(&mut bom).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;

    let encoding_kind = parse_text_encoding_kind(encoding)?;
    let mut align_base: Option<u64> = None;
    let needle = match encoding_kind {
        TextEncodingKind::Utf16Le => {
            if !match_case {
                return Err(
                    "Case-insensitive find for UTF-16LE is not supported in text chunk mode."
                        .to_string(),
                );
            }
            align_base = Some(if bom_read >= 2 && bom == [0xFF, 0xFE] {
                2
            } else {
                0
            });
            encode_text_with_encoding_kind(find, TextEncodingKind::Utf16Le)?
        }
        _ => {
            if !match_case && !find.is_ascii() {
                return Err(
                    "Case-insensitive find in text chunk mode currently supports ASCII only."
                        .to_string(),
                );
            }
            encode_text_with_encoding_kind(find, encoding_kind)?
        }
    };

    if needle.is_empty() {
        return Err("Find text is required.".to_string());
    }

    let started_at = Instant::now();
    let mut matches: Vec<FindMatchEntry> = Vec::new();
    let mut has_more = false;
    let mut scanned_bytes = 0usize;
    let mut last_progress = 0.0f32;
    let mut emitted_matches = 0usize;
    let mut absolute_read = 0u64;
    let mut carry: Vec<u8> = Vec::new();
    let mut read_buf = vec![0u8; 1024 * 1024];
    let overlap = needle.len().saturating_sub(1);

    loop {
        if is_canceled() {
            return Err("canceled".to_string());
        }
        let read_len = file.read(&mut read_buf).map_err(|e| e.to_string())?;
        if read_len == 0 {
            break;
        }
        scanned_bytes = scanned_bytes.saturating_add(read_len);

        let data_offset = absolute_read.saturating_sub(carry.len() as u64);
        let mut data = Vec::with_capacity(carry.len() + read_len);
        data.extend_from_slice(&carry);
        data.extend_from_slice(&read_buf[..read_len]);

        let searchable_end = data.len().saturating_sub(needle.len()).saturating_add(1);
        for idx in 0..searchable_end {
            let abs = data_offset + idx as u64;
            if let Some(base) = align_base {
                if abs < base || (abs - base) % 2 != 0 {
                    continue;
                }
            }
            if !bytes_match_at(&data, &needle, idx, match_case) {
                continue;
            }
            matches.push(FindMatchEntry {
                row: abs as usize,
                col: needle.len(),
                value: String::new(),
            });
            if matches.len() > max_matches {
                has_more = true;
                matches.truncate(max_matches);
                break;
            }
        }
        if matches.len() > emitted_matches {
            on_matches(&matches[emitted_matches..]);
            emitted_matches = matches.len();
        }
        if has_more {
            break;
        }

        carry.clear();
        if overlap > 0 && data.len() >= overlap {
            carry.extend_from_slice(&data[data.len() - overlap..]);
        } else if overlap > 0 {
            carry.extend_from_slice(&data);
        }

        absolute_read = absolute_read.saturating_add(read_len as u64);
        let progress = (absolute_read as f32 / file_len as f32).clamp(0.0, 0.98);
        if progress - last_progress >= 0.01 {
            last_progress = progress;
            on_progress(progress, matches.len(), scanned_bytes);
        }
    }

    if matches.len() > emitted_matches {
        on_matches(&matches[emitted_matches..]);
    }
    on_progress(1.0, matches.len(), scanned_bytes);
    Ok(FindMatchesResult {
        matches,
        has_more,
        scanned_rows: scanned_bytes,
        elapsed_ms: started_at.elapsed().as_millis() as u64,
    })
}

fn scan_text_regex_matches<FIsCanceled, FOnProgress, FOnMatches>(
    path: &str,
    pattern: &str,
    match_case: bool,
    encoding: &str,
    max_matches: usize,
    mut is_canceled: FIsCanceled,
    mut on_progress: FOnProgress,
    mut on_matches: FOnMatches,
) -> Result<FindMatchesResult, String>
where
    FIsCanceled: FnMut() -> bool,
    FOnProgress: FnMut(f32, usize, usize),
    FOnMatches: FnMut(&[FindMatchEntry]),
{
    if pattern.is_empty() {
        return Err("Find text is required.".to_string());
    }
    const CHUNK_BYTES: usize = 1024 * 1024;
    const OVERLAP_BYTES: usize = 256 * 1024;

    let started_at = Instant::now();
    let mut matches: Vec<FindMatchEntry> = Vec::new();
    let mut has_more = false;
    let mut scanned_bytes = 0usize;
    let mut last_progress = 0.0f32;
    let mut emitted_matches = 0usize;
    let mut processed_until_global = 0u64;
    let is_utf16 = encoding.to_uppercase() == "UTF-16LE";

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let file_len = file.metadata().map_err(|e| e.to_string())?.len().max(1);
    let mut absolute_read = 0u64;
    let mut carry: Vec<u8> = Vec::new();
    let mut read_buf = vec![0u8; CHUNK_BYTES];

    if is_utf16 {
        let mut bom = [0u8; 2];
        let bom_read = file.read(&mut bom).map_err(|e| e.to_string())?;
        let utf16_start = if bom_read >= 2 && bom == [0xFF, 0xFE] {
            2u64
        } else {
            0u64
        };
        file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;

        let mut builder = regex::RegexBuilder::new(pattern);
        builder.case_insensitive(!match_case);
        let re = builder.build().map_err(|e| e.to_string())?;

        loop {
            if is_canceled() {
                return Err("canceled".to_string());
            }
            let read_len = file.read(&mut read_buf).map_err(|e| e.to_string())?;
            let eof = read_len == 0;
            if eof && carry.is_empty() {
                break;
            }
            if read_len > 0 {
                scanned_bytes = scanned_bytes.saturating_add(read_len);
            }

            let data_offset = absolute_read.saturating_sub(carry.len() as u64);
            let mut data = Vec::with_capacity(carry.len() + read_len);
            data.extend_from_slice(&carry);
            data.extend_from_slice(&read_buf[..read_len]);

            let mut decode_start = 0usize;
            if data_offset == 0 && data.len() >= 2 && data[0] == 0xFF && data[1] == 0xFE {
                decode_start = 2;
            } else if data_offset < utf16_start {
                decode_start = (utf16_start - data_offset) as usize;
            }
            if decode_start > data.len() {
                decode_start = data.len();
            }

            let mut decode_end = data.len();
            let decode_span = decode_end.saturating_sub(decode_start);
            decode_end = decode_start + decode_span - (decode_span % 2);

            let mut safe_emit_end = if eof {
                decode_end
            } else {
                data.len().saturating_sub(OVERLAP_BYTES).min(decode_end)
            };
            if safe_emit_end < decode_start {
                safe_emit_end = decode_start;
            }
            safe_emit_end -= (safe_emit_end - decode_start) % 2;

            if decode_end > decode_start {
                let mut units = Vec::with_capacity((decode_end - decode_start) / 2);
                let mut idx = decode_start;
                while idx + 1 < decode_end {
                    units.push(u16::from_le_bytes([data[idx], data[idx + 1]]));
                    idx += 2;
                }
                let text = String::from_utf16_lossy(&units);
                let decode_global_start = data_offset.saturating_add(decode_start as u64);
                let safe_global_end = data_offset.saturating_add(safe_emit_end as u64);

                for m in re.find_iter(&text) {
                    let start_u16 = text[..m.start()].encode_utf16().count();
                    let len_u16 = text[m.start()..m.end()].encode_utf16().count();
                    let global_start = decode_global_start.saturating_add((start_u16 * 2) as u64);
                    let global_end = global_start.saturating_add((len_u16 * 2) as u64);
                    if global_end <= processed_until_global {
                        continue;
                    }
                    if !eof && global_end > safe_global_end {
                        continue;
                    }
                    matches.push(FindMatchEntry {
                        row: global_start as usize,
                        col: (len_u16 * 2).max(2),
                        value: String::new(),
                    });
                    if matches.len() > max_matches {
                        has_more = true;
                        matches.truncate(max_matches);
                        break;
                    }
                }
            }
            if matches.len() > emitted_matches {
                on_matches(&matches[emitted_matches..]);
                emitted_matches = matches.len();
            }

            if has_more {
                break;
            }

            processed_until_global = data_offset.saturating_add(safe_emit_end as u64);
            carry.clear();
            if !eof {
                let keep = data.len().min(OVERLAP_BYTES);
                carry.extend_from_slice(&data[data.len() - keep..]);
            }

            absolute_read = absolute_read.saturating_add(read_len as u64);
            let progress = (absolute_read as f32 / file_len as f32).clamp(0.0, 0.98);
            if progress - last_progress >= 0.01 {
                last_progress = progress;
                on_progress(progress, matches.len(), scanned_bytes);
            }
            if eof {
                break;
            }
        }
    } else {
        let mut builder = regex::bytes::RegexBuilder::new(pattern);
        builder.case_insensitive(!match_case);
        let re = builder.build().map_err(|e| e.to_string())?;

        loop {
            if is_canceled() {
                return Err("canceled".to_string());
            }
            let read_len = file.read(&mut read_buf).map_err(|e| e.to_string())?;
            let eof = read_len == 0;
            if eof && carry.is_empty() {
                break;
            }
            if read_len > 0 {
                scanned_bytes = scanned_bytes.saturating_add(read_len);
            }

            let data_offset = absolute_read.saturating_sub(carry.len() as u64);
            let mut data = Vec::with_capacity(carry.len() + read_len);
            data.extend_from_slice(&carry);
            data.extend_from_slice(&read_buf[..read_len]);

            let mut decode_start = 0usize;
            if data_offset == 0
                && data.len() >= 3
                && data[0] == 0xEF
                && data[1] == 0xBB
                && data[2] == 0xBF
            {
                decode_start = 3;
            }
            let safe_emit_end = if eof {
                data.len()
            } else {
                data.len().saturating_sub(OVERLAP_BYTES)
            };
            let safe_global_end = data_offset.saturating_add(safe_emit_end as u64);

            for m in re.find_iter(&data[decode_start..]) {
                let start = decode_start + m.start();
                let end = decode_start + m.end();
                let global_start = data_offset.saturating_add(start as u64);
                let global_end = data_offset.saturating_add(end as u64);
                if global_end <= processed_until_global {
                    continue;
                }
                if !eof && global_end > safe_global_end {
                    continue;
                }
                matches.push(FindMatchEntry {
                    row: global_start as usize,
                    col: end.saturating_sub(start).max(1),
                    value: String::new(),
                });
                if matches.len() > max_matches {
                    has_more = true;
                    matches.truncate(max_matches);
                    break;
                }
            }
            if matches.len() > emitted_matches {
                on_matches(&matches[emitted_matches..]);
                emitted_matches = matches.len();
            }

            if has_more {
                break;
            }

            processed_until_global = safe_global_end;
            carry.clear();
            if !eof {
                let keep = data.len().min(OVERLAP_BYTES);
                carry.extend_from_slice(&data[data.len() - keep..]);
            }

            absolute_read = absolute_read.saturating_add(read_len as u64);
            let progress = (absolute_read as f32 / file_len as f32).clamp(0.0, 0.98);
            if progress - last_progress >= 0.01 {
                last_progress = progress;
                on_progress(progress, matches.len(), scanned_bytes);
            }
            if eof {
                break;
            }
        }
    }

    if matches.len() > emitted_matches {
        on_matches(&matches[emitted_matches..]);
    }
    on_progress(1.0, matches.len(), scanned_bytes);
    Ok(FindMatchesResult {
        matches,
        has_more,
        scanned_rows: scanned_bytes,
        elapsed_ms: started_at.elapsed().as_millis() as u64,
    })
}

fn replace_text_literal_in_file<FIsCanceled, FOnProgress>(
    source_path: &str,
    target_path: &str,
    find: &str,
    replace: &str,
    match_case: bool,
    preserve_case: bool,
    encoding: &str,
    mut is_canceled: FIsCanceled,
    mut on_progress: FOnProgress,
) -> Result<(usize, usize), String>
where
    FIsCanceled: FnMut() -> bool,
    FOnProgress: FnMut(f32, usize, usize),
{
    if find.is_empty() {
        return Err("Find text is required.".to_string());
    }

    let source = PathBuf::from(source_path);
    let target = PathBuf::from(target_path);
    let same_path = source == target;

    let mut input = File::open(&source).map_err(|e| e.to_string())?;
    let source_len = input.metadata().map_err(|e| e.to_string())?.len().max(1);
    let mut bom = [0u8; 2];
    let bom_read = input.read(&mut bom).map_err(|e| e.to_string())?;
    input.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;

    let encoding_kind = parse_text_encoding_kind(encoding)?;
    let mut align_base: Option<u64> = None;
    let needle = match encoding_kind {
        TextEncodingKind::Utf16Le => {
            if !match_case {
                return Err(
                    "Case-insensitive replace for UTF-16LE is not supported in text chunk mode."
                        .to_string(),
                );
            }
            align_base = Some(if bom_read >= 2 && bom == [0xFF, 0xFE] {
                2
            } else {
                0
            });
            encode_text_with_encoding_kind(find, TextEncodingKind::Utf16Le)?
        }
        _ => {
            if !match_case && !find.is_ascii() {
                return Err(
                    "Case-insensitive replace in text chunk mode currently supports ASCII only."
                        .to_string(),
                );
            }
            encode_text_with_encoding_kind(find, encoding_kind)?
        }
    };
    if needle.is_empty() {
        return Err("Find text is required.".to_string());
    }

    let replacement_bytes = encode_text_with_encoding_kind(replace, encoding_kind)?;

    let temp_path = if same_path {
        let parent = target
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        Some(parent.join(format!(
            ".nmeditor_text_replace_{}_{}.tmp",
            std::process::id(),
            stamp
        )))
    } else {
        None
    };
    let journal = if same_path {
        let temp = temp_path
            .as_ref()
            .ok_or_else(|| "missing temp path for in-place text replace".to_string())?;
        Some(create_replace_journal(
            &target,
            temp,
            "replace_text_literal_in_file",
        )?)
    } else {
        None
    };
    let write_path = temp_path.clone().unwrap_or_else(|| target.clone());

    let mut read_buf = vec![0u8; 1024 * 1024];
    let mut carry: Vec<u8> = Vec::new();
    let mut absolute_read = 0u64;
    let mut scanned_bytes = 0usize;
    let mut replaced_count = 0usize;
    let mut last_progress = 0.0f32;

    let write_result = (|| -> Result<(), String> {
        let mut output = File::create(&write_path).map_err(|e| e.to_string())?;
        loop {
            if is_canceled() {
                return Err("canceled".to_string());
            }
            let read_len = input.read(&mut read_buf).map_err(|e| e.to_string())?;
            let eof = read_len == 0;
            if eof && carry.is_empty() {
                break;
            }
            if read_len > 0 {
                scanned_bytes = scanned_bytes.saturating_add(read_len);
            }

            let data_offset = absolute_read.saturating_sub(carry.len() as u64);
            let mut data = Vec::with_capacity(carry.len() + read_len);
            data.extend_from_slice(&carry);
            data.extend_from_slice(&read_buf[..read_len]);

            let mut idx = 0usize;
            while idx + needle.len() <= data.len() {
                let abs = data_offset + idx as u64;
                if let Some(base) = align_base {
                    if abs < base || (abs - base) % 2 != 0 {
                        output
                            .write_all(&data[idx..idx + 1])
                            .map_err(|e| e.to_string())?;
                        idx += 1;
                        continue;
                    }
                }
                if !bytes_match_at(&data, &needle, idx, match_case) {
                    output
                        .write_all(&data[idx..idx + 1])
                        .map_err(|e| e.to_string())?;
                    idx += 1;
                    continue;
                }
                if preserve_case {
                    let matched = &data[idx..idx + needle.len()];
                    let source_text = decode_bytes_with_encoding_kind(matched, encoding_kind);
                    let replacement = apply_replacement_case_pattern(replace, &source_text);
                    let replacement_bytes =
                        encode_text_with_encoding_kind(&replacement, encoding_kind)?;
                    output
                        .write_all(&replacement_bytes)
                        .map_err(|e| e.to_string())?;
                } else {
                    output
                        .write_all(&replacement_bytes)
                        .map_err(|e| e.to_string())?;
                }
                replaced_count = replaced_count.saturating_add(1);
                idx += needle.len();
            }

            carry.clear();
            if eof {
                if idx < data.len() {
                    output.write_all(&data[idx..]).map_err(|e| e.to_string())?;
                }
            } else if idx < data.len() {
                carry.extend_from_slice(&data[idx..]);
            }

            absolute_read = absolute_read.saturating_add(read_len as u64);
            let progress = (absolute_read as f32 / source_len as f32).clamp(0.0, 0.98);
            if progress - last_progress >= 0.01 || eof {
                last_progress = progress;
                on_progress(progress, replaced_count, scanned_bytes);
            }
            if eof {
                break;
            }
        }
        output.flush().map_err(|e| e.to_string())?;
        Ok(())
    })();

    if write_result.is_err() {
        if let Some(journal) = journal.as_ref() {
            cleanup_replace_journal(journal);
        } else if let Some(temp) = temp_path {
            let _ = fs::remove_file(temp);
        }
        return write_result.map(|_| (0, 0));
    }

    if let Some(temp) = temp_path {
        if replaced_count > 0 {
            if fs::rename(&temp, &target).is_err() {
                if target.exists() {
                    fs::remove_file(&target).map_err(|e| e.to_string())?;
                }
                if let Err(err) = fs::rename(&temp, &target) {
                    if let Some(journal) = journal.as_ref() {
                        let _ = restore_target_from_replace_journal(journal);
                        cleanup_replace_journal(journal);
                    }
                    return Err(err.to_string());
                }
            }
        } else {
            let _ = fs::remove_file(temp);
        }
    }
    if let Some(journal) = journal.as_ref() {
        cleanup_replace_journal(journal);
    }

    on_progress(1.0, replaced_count, scanned_bytes);
    Ok((replaced_count, scanned_bytes))
}

fn replace_text_regex_in_file<FIsCanceled, FOnProgress>(
    source_path: &str,
    target_path: &str,
    pattern: &str,
    replace: &str,
    match_case: bool,
    encoding: &str,
    mut is_canceled: FIsCanceled,
    mut on_progress: FOnProgress,
) -> Result<(usize, usize), String>
where
    FIsCanceled: FnMut() -> bool,
    FOnProgress: FnMut(f32, usize, usize),
{
    if pattern.is_empty() {
        return Err("Find text is required.".to_string());
    }

    let source = PathBuf::from(source_path);
    let target = PathBuf::from(target_path);
    let same_path = source == target;
    let encoding_kind = parse_text_encoding_kind(encoding)?;
    let is_utf16 = encoding_kind == TextEncodingKind::Utf16Le;

    if !is_utf16
        && matches!(
            encoding_kind,
            TextEncodingKind::Gbk | TextEncodingKind::ShiftJis
        )
        && !pattern.is_ascii()
    {
        return Err(
            "Regex find/replace for GBK or SHIFT-JIS currently supports ASCII pattern only."
                .to_string(),
        );
    }

    if is_utf16 {
        let mut builder = regex::RegexBuilder::new(pattern);
        builder.case_insensitive(!match_case);
        let re = builder.build().map_err(|e| e.to_string())?;
        if re.is_match("") {
            return Err(
                "Regex that matches empty text is not supported for file replace.".to_string(),
            );
        }
    } else {
        let mut builder = regex::bytes::RegexBuilder::new(pattern);
        builder.case_insensitive(!match_case);
        let re = builder.build().map_err(|e| e.to_string())?;
        if re.is_match(b"") {
            return Err(
                "Regex that matches empty text is not supported for file replace.".to_string(),
            );
        }
    }

    let scan = scan_text_regex_matches(
        source_path,
        pattern,
        match_case,
        encoding,
        500_000,
        || is_canceled(),
        |progress, matched, scanned| {
            on_progress((progress * 0.78).clamp(0.0, 0.78), matched, scanned);
        },
        |_| {},
    )?;
    if scan.has_more {
        return Err(
            "Too many matches for file replace (limit 500000). Narrow your pattern and retry."
                .to_string(),
        );
    }
    if scan.matches.is_empty() {
        on_progress(1.0, 0, scan.scanned_rows);
        return Ok((0, scan.scanned_rows));
    }

    let temp_path = if same_path {
        let parent = target
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        Some(parent.join(format!(
            ".nmeditor_text_replace_regex_{}_{}.tmp",
            std::process::id(),
            stamp
        )))
    } else {
        None
    };
    let journal = if same_path {
        let temp = temp_path
            .as_ref()
            .ok_or_else(|| "missing temp path for in-place regex replace".to_string())?;
        Some(create_replace_journal(
            &target,
            temp,
            "replace_text_regex_in_file",
        )?)
    } else {
        None
    };
    let write_path = temp_path.clone().unwrap_or_else(|| target.clone());

    let write_result = (|| -> Result<(), String> {
        let mut input = File::open(&source).map_err(|e| e.to_string())?;
        let mut output = File::create(&write_path).map_err(|e| e.to_string())?;
        let mut cursor = 0u64;
        let total = scan.matches.len().max(1) as f32;
        let replacement_template = if !is_utf16 {
            Some(encode_text_with_encoding_kind(replace, encoding_kind)?)
        } else {
            None
        };

        if is_utf16 {
            let mut builder = regex::RegexBuilder::new(pattern);
            builder.case_insensitive(!match_case);
            let re = builder.build().map_err(|e| e.to_string())?;
            for (idx, m) in scan.matches.iter().enumerate() {
                if is_canceled() {
                    return Err("canceled".to_string());
                }
                let start = m.row as u64;
                let len = m.col as u64;
                if start < cursor {
                    continue;
                }
                input
                    .seek(SeekFrom::Start(cursor))
                    .map_err(|e| e.to_string())?;
                {
                    let mut prefix = std::io::Read::by_ref(&mut input).take(start - cursor);
                    std::io::copy(&mut prefix, &mut output).map_err(|e| e.to_string())?;
                }
                input
                    .seek(SeekFrom::Start(start))
                    .map_err(|e| e.to_string())?;
                let mut matched_bytes = vec![0u8; len as usize];
                input
                    .read_exact(&mut matched_bytes)
                    .map_err(|e| e.to_string())?;
                if matched_bytes.len() % 2 != 0 {
                    return Err("Invalid UTF-16LE match span.".to_string());
                }
                let mut units = Vec::with_capacity(matched_bytes.len() / 2);
                let mut pos = 0usize;
                while pos + 1 < matched_bytes.len() {
                    units.push(u16::from_le_bytes([
                        matched_bytes[pos],
                        matched_bytes[pos + 1],
                    ]));
                    pos += 2;
                }
                let matched_text = String::from_utf16_lossy(&units);
                let replaced_text = re.replace(&matched_text, replace).to_string();
                let mut replaced_bytes = Vec::with_capacity(replaced_text.len() * 2);
                for unit in replaced_text.encode_utf16() {
                    replaced_bytes.extend_from_slice(&unit.to_le_bytes());
                }
                output
                    .write_all(&replaced_bytes)
                    .map_err(|e| e.to_string())?;
                cursor = start.saturating_add(len);
                let progress = 0.78 + 0.2 * ((idx + 1) as f32 / total);
                on_progress(progress.clamp(0.0, 0.98), idx + 1, scan.scanned_rows);
            }
        } else {
            let mut builder = regex::bytes::RegexBuilder::new(pattern);
            builder.case_insensitive(!match_case);
            let re = builder.build().map_err(|e| e.to_string())?;
            for (idx, m) in scan.matches.iter().enumerate() {
                if is_canceled() {
                    return Err("canceled".to_string());
                }
                let start = m.row as u64;
                let len = m.col as u64;
                if start < cursor {
                    continue;
                }
                input
                    .seek(SeekFrom::Start(cursor))
                    .map_err(|e| e.to_string())?;
                {
                    let mut prefix = std::io::Read::by_ref(&mut input).take(start - cursor);
                    std::io::copy(&mut prefix, &mut output).map_err(|e| e.to_string())?;
                }
                input
                    .seek(SeekFrom::Start(start))
                    .map_err(|e| e.to_string())?;
                let mut matched_bytes = vec![0u8; len as usize];
                input
                    .read_exact(&mut matched_bytes)
                    .map_err(|e| e.to_string())?;
                let template = replacement_template
                    .as_ref()
                    .ok_or_else(|| "missing replacement template".to_string())?;
                let replaced_bytes = re.replace(&matched_bytes, template.as_slice()).into_owned();
                output
                    .write_all(&replaced_bytes)
                    .map_err(|e| e.to_string())?;
                cursor = start.saturating_add(len);
                let progress = 0.78 + 0.2 * ((idx + 1) as f32 / total);
                on_progress(progress.clamp(0.0, 0.98), idx + 1, scan.scanned_rows);
            }
        }

        input
            .seek(SeekFrom::Start(cursor))
            .map_err(|e| e.to_string())?;
        std::io::copy(&mut input, &mut output).map_err(|e| e.to_string())?;
        output.flush().map_err(|e| e.to_string())?;
        Ok(())
    })();

    if write_result.is_err() {
        if let Some(journal) = journal.as_ref() {
            cleanup_replace_journal(journal);
        } else if let Some(temp) = temp_path {
            let _ = fs::remove_file(temp);
        }
        return write_result.map(|_| (0, 0));
    }

    if let Some(temp) = temp_path {
        if fs::rename(&temp, &target).is_err() {
            if target.exists() {
                fs::remove_file(&target).map_err(|e| e.to_string())?;
            }
            if let Err(err) = fs::rename(&temp, &target) {
                if let Some(journal) = journal.as_ref() {
                    let _ = restore_target_from_replace_journal(journal);
                    cleanup_replace_journal(journal);
                }
                return Err(err.to_string());
            }
        }
    }
    if let Some(journal) = journal.as_ref() {
        cleanup_replace_journal(journal);
    }

    on_progress(1.0, scan.matches.len(), scan.scanned_rows);
    Ok((scan.matches.len(), scan.scanned_rows))
}

fn build_csv_index_for_file(
    path: &PathBuf,
    delimiter_byte: u8,
    has_headers: bool,
) -> Result<CsvIndex, String> {
    let (file_len, modified) = file_signature(path)?;
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(has_headers)
        .delimiter(delimiter_byte)
        .from_reader(BufReader::new(File::open(path).map_err(|e| e.to_string())?));

    if has_headers {
        let _ = reader.headers().map_err(|e| e.to_string())?;
    }
    let mut offsets = Vec::new();
    let mut record = csv::StringRecord::new();
    let mut row_index = 0usize;
    let mut last_pos = reader.position().byte();
    let data_start = last_pos;

    loop {
        if !reader.read_record(&mut record).map_err(|e| e.to_string())? {
            break;
        }
        let record_start = last_pos;
        if row_index % INDEX_STRIDE == 0 {
            offsets.push(CsvIndexEntry {
                row: row_index,
                byte: record_start,
            });
        }
        row_index += 1;
        last_pos = reader.position().byte();
    }

    Ok(CsvIndex {
        data_start,
        offsets,
        file_len,
        modified,
        total_rows: row_index,
    })
}

#[tauri::command]
fn cancel_prepare_csv_index(state: tauri::State<AppState>, job_id: u64) -> Result<bool, String> {
    let jobs = state.index_jobs.lock().map_err(|_| "lock poisoned")?;
    if let Some(job) = jobs.get(&job_id) {
        job.cancel_flag.store(true, Ordering::Relaxed);
        return Ok(true);
    }
    Ok(false)
}

fn find_index_base(index: &CsvIndex, start: usize) -> (usize, u64) {
    let mut base_row = 0usize;
    let mut base_offset = index.data_start;
    for entry in &index.offsets {
        if entry.row > start {
            break;
        }
        base_row = entry.row;
        base_offset = entry.byte;
    }
    (base_row, base_offset)
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
        .from_reader(BufReader::new(
            File::open(&path_buf).map_err(|e| e.to_string())?,
        ));

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
            row_indices: None,
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
        row_indices: None,
    })
}

fn read_csv_rows_window_internal(
    state: &AppState,
    path: String,
    delimiter: Option<String>,
    start: usize,
    limit: usize,
    has_headers: bool,
) -> Result<CsvSlice, String> {
    let path_buf = PathBuf::from(&path);

    let delimiter_byte = if let Some(value) = delimiter.as_deref() {
        parse_delimiter(value)
    } else {
        let mut sample = String::new();
        let sample_reader = BufReader::new(File::open(&path_buf).map_err(|e| e.to_string())?);
        sample_reader
            .take(64 * 1024)
            .read_to_string(&mut sample)
            .map_err(|e| e.to_string())?;
        detect_delimiter(&sample)
    };

    let signature = file_signature(&path_buf)?;
    let key = index_key(&path, delimiter_byte);
    let index = {
        let mut indexes = state.indexes.lock().map_err(|_| "lock poisoned")?;
        if let Some(candidate) = indexes.get(&key) {
            if candidate.file_len == signature.0 && candidate.modified == signature.1 {
                Some(Arc::clone(candidate))
            } else {
                indexes.remove(&key);
                None
            }
        } else {
            None
        }
    };

    if let Some(index) = index {
        let (base_row, base_offset) = find_index_base(&index, start);
        let mut file = File::open(&path_buf).map_err(|e| e.to_string())?;
        file.seek(SeekFrom::Start(base_offset))
            .map_err(|e| e.to_string())?;
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .delimiter(delimiter_byte)
            .from_reader(BufReader::new(file));

        let mut record = csv::StringRecord::new();
        let mut current = base_row;
        while current < start {
            if !reader.read_record(&mut record).map_err(|e| e.to_string())? {
                break;
            }
            current += 1;
        }

        let mut rows = Vec::new();
        while rows.len() < limit {
            if !reader.read_record(&mut record).map_err(|e| e.to_string())? {
                break;
            }
            rows.push(record.iter().map(|s| s.to_string()).collect());
        }

        let eof = rows.len() < limit;
        let end = start + rows.len();

        return Ok(CsvSlice {
            rows,
            start,
            end,
            eof,
            row_indices: None,
        });
    }

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(has_headers)
        .delimiter(delimiter_byte)
        .from_reader(BufReader::new(
            File::open(&path_buf).map_err(|e| e.to_string())?,
        ));

    if has_headers {
        let _ = reader.headers().map_err(|e| e.to_string())?;
    }

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
        row_indices: None,
    })
}

#[tauri::command]
fn read_csv_rows_window(
    state: tauri::State<AppState>,
    path: String,
    delimiter: Option<String>,
    start: usize,
    limit: usize,
) -> Result<CsvSlice, String> {
    read_csv_rows_window_internal(&state, path, delimiter, start, limit, true)
}

#[tauri::command]
fn read_file_head_bytes(path: String, max_bytes: usize) -> Result<Vec<u8>, String> {
    let safe_max = max_bytes.clamp(1, 64 * 1024 * 1024);
    let mut file = File::open(PathBuf::from(path)).map_err(|e| e.to_string())?;
    let mut buffer = vec![0u8; safe_max];
    let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
    buffer.truncate(bytes_read);
    Ok(buffer)
}

#[tauri::command]
fn read_file_bytes_range(path: String, offset: u64, max_bytes: usize) -> Result<Vec<u8>, String> {
    let safe_max = max_bytes.clamp(1, 64 * 1024 * 1024);
    let mut file = File::open(PathBuf::from(path)).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(offset))
        .map_err(|e| e.to_string())?;
    let mut buffer = vec![0u8; safe_max];
    let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
    buffer.truncate(bytes_read);
    Ok(buffer)
}

#[tauri::command]
fn encode_text_with_encoding(
    text: String,
    encoding: Option<String>,
    bom: Option<bool>,
) -> Result<Vec<u8>, String> {
    let encoding_raw = encoding.unwrap_or_else(|| "UTF-8".to_string());
    let kind = parse_text_encoding_kind(&encoding_raw)?;
    let mut bytes = encode_text_with_encoding_kind(&text, kind)?;
    if bom.unwrap_or(false) {
        match kind {
            TextEncodingKind::Utf8 => {
                let mut with_bom = vec![0xEF, 0xBB, 0xBF];
                with_bom.extend_from_slice(&bytes);
                bytes = with_bom;
            }
            TextEncodingKind::Utf16Le => {
                let mut with_bom = vec![0xFF, 0xFE];
                with_bom.extend_from_slice(&bytes);
                bytes = with_bom;
            }
            TextEncodingKind::Gbk | TextEncodingKind::ShiftJis => {}
        }
    }
    Ok(bytes)
}

#[tauri::command]
fn replace_file_bytes_range(
    source_path: String,
    target_path: String,
    offset: u64,
    delete_len: usize,
    insert_bytes: Vec<u8>,
) -> Result<(), String> {
    let source = PathBuf::from(&source_path);
    let target = PathBuf::from(&target_path);
    let same_path = source == target;

    let mut input = File::open(&source).map_err(|e| e.to_string())?;
    let source_len = input.metadata().map_err(|e| e.to_string())?.len();
    if offset > source_len {
        return Err("offset out of range".to_string());
    }
    let delete_end = offset.saturating_add(delete_len as u64).min(source_len);

    let temp_path = if same_path {
        let parent = target
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        Some(parent.join(format!(
            ".nmeditor_patch_{}_{}.tmp",
            std::process::id(),
            stamp
        )))
    } else {
        None
    };
    let journal = if same_path {
        let temp = temp_path
            .as_ref()
            .ok_or_else(|| "missing temp path for in-place patch".to_string())?;
        Some(create_replace_journal(
            &target,
            temp,
            "replace_file_bytes_range",
        )?)
    } else {
        None
    };

    let write_path = temp_path.clone().unwrap_or_else(|| target.clone());
    let write_result = (|| -> Result<(), String> {
        let mut output = File::create(&write_path).map_err(|e| e.to_string())?;
        {
            let mut prefix = std::io::Read::by_ref(&mut input).take(offset);
            std::io::copy(&mut prefix, &mut output).map_err(|e| e.to_string())?;
        }
        output.write_all(&insert_bytes).map_err(|e| e.to_string())?;
        input
            .seek(SeekFrom::Start(delete_end))
            .map_err(|e| e.to_string())?;
        std::io::copy(&mut input, &mut output).map_err(|e| e.to_string())?;
        output.flush().map_err(|e| e.to_string())?;
        Ok(())
    })();

    if write_result.is_err() {
        if let Some(journal) = journal.as_ref() {
            cleanup_replace_journal(journal);
        } else if let Some(temp) = temp_path {
            let _ = fs::remove_file(temp);
        }
        return write_result;
    }

    if let Some(temp) = temp_path {
        if fs::rename(&temp, &target).is_err() {
            if target.exists() {
                fs::remove_file(&target).map_err(|e| e.to_string())?;
            }
            if let Err(err) = fs::rename(&temp, &target) {
                if let Some(journal) = journal.as_ref() {
                    let _ = restore_target_from_replace_journal(journal);
                    cleanup_replace_journal(journal);
                }
                return Err(err.to_string());
            }
        }
    }
    if let Some(journal) = journal.as_ref() {
        cleanup_replace_journal(journal);
    }

    Ok(())
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
        .from_reader(BufReader::new(
            File::open(&path_buf).map_err(|e| e.to_string())?,
        ));

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
            ColumnOp::Duplicate { index, name, .. } => {
                let idx = (*index).min(headers.len());
                headers.insert(idx, name.clone());
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
            ColumnOp::Duplicate { index, from, .. } => {
                let idx = (*index).min(row.len());
                let source = if *from < row.len() {
                    row[*from].clone()
                } else {
                    String::new()
                };
                row.insert(idx, source);
            }
        }
    }
}

fn build_patch_map(patches: &[CsvPatch]) -> HashMap<usize, HashMap<usize, String>> {
    let mut patch_map: HashMap<usize, HashMap<usize, String>> = HashMap::new();
    for patch in patches {
        patch_map
            .entry(patch.row)
            .or_default()
            .insert(patch.col, patch.value.clone());
    }
    patch_map
}

fn row_matches_filters(row: &[String], filters: &[FilterRule]) -> bool {
    const IN_FILTER_PREFIX: &str = "@in-json:";
    for rule in filters {
        if rule.value.is_empty() {
            continue;
        }
        if rule.column >= row.len() {
            return false;
        }
        if let Some(raw) = rule.value.strip_prefix(IN_FILTER_PREFIX) {
            let targets: Vec<String> = serde_json::from_str(raw).unwrap_or_default();
            if targets.is_empty() {
                return false;
            }
            if !targets.iter().any(|target| row[rule.column] == *target) {
                return false;
            }
        } else if !row[rule.column].contains(&rule.value) {
            return false;
        }
    }
    true
}

fn build_sort_key(row: &[String], rules: &[SortRule]) -> SortKey {
    let mut items = Vec::with_capacity(rules.len());
    for rule in rules {
        let value = row.get(rule.column).map(|s| s.as_str()).unwrap_or("");
        let text = value.to_lowercase();
        let num = value.parse::<f64>().ok();
        let desc = rule.direction == "desc";
        items.push(SortKeyItem { text, num, desc });
    }
    SortKey { items }
}

fn compare_rows(a: &[String], b: &[String], rules: &[SortRule]) -> CmpOrdering {
    for rule in rules {
        let a_value = a.get(rule.column).map(|s| s.as_str()).unwrap_or("");
        let b_value = b.get(rule.column).map(|s| s.as_str()).unwrap_or("");

        let order = match (a_value.parse::<f64>(), b_value.parse::<f64>()) {
            (Ok(a_num), Ok(b_num)) => a_num.partial_cmp(&b_num).unwrap_or(CmpOrdering::Equal),
            _ => a_value.to_lowercase().cmp(&b_value.to_lowercase()),
        };

        if order != CmpOrdering::Equal {
            return if rule.direction == "desc" {
                order.reverse()
            } else {
                order
            };
        }
    }
    CmpOrdering::Equal
}

fn stream_rows_with_ops(
    path: &PathBuf,
    delimiter_byte: u8,
    row_ops: &[RowOp],
    column_ops: &[ColumnOp],
    patch_map: &HashMap<usize, HashMap<usize, String>>,
    clear_rows: &HashSet<usize>,
    clear_cols: &HashSet<usize>,
    mut on_row: impl FnMut(usize, Vec<String>) -> Result<(), String>,
) -> Result<Vec<String>, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .from_reader(BufReader::new(File::open(path).map_err(|e| e.to_string())?));

    let mut headers = reader
        .headers()
        .map(|h| h.iter().map(|s| s.to_string()).collect::<Vec<_>>())
        .map_err(|e| e.to_string())?;

    apply_column_ops_to_headers(&mut headers, column_ops);

    let normalized_ops = normalize_row_ops(row_ops);
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
                    apply_column_ops_to_row(&mut row, column_ops);
                    if clear_rows.contains(&output_index) {
                        for value in row.iter_mut() {
                            *value = String::new();
                        }
                    } else if !clear_cols.is_empty() {
                        for col_idx in clear_cols {
                            if *col_idx >= row.len() {
                                row.resize(*col_idx + 1, String::new());
                            }
                            row[*col_idx] = String::new();
                        }
                    }
                    if let Some(row_patches) = patch_map.get(&output_index) {
                        for (col_idx, value) in row_patches {
                            if *col_idx >= row.len() {
                                row.resize(col_idx + 1, String::new());
                            }
                            row[*col_idx] = value.clone();
                        }
                    }
                    on_row(output_index, row)?;
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
        apply_column_ops_to_row(&mut row, column_ops);
        if clear_rows.contains(&output_index) {
            for value in row.iter_mut() {
                *value = String::new();
            }
        } else if !clear_cols.is_empty() {
            for col_idx in clear_cols {
                if *col_idx >= row.len() {
                    row.resize(*col_idx + 1, String::new());
                }
                row[*col_idx] = String::new();
            }
        }
        if let Some(row_patches) = patch_map.get(&output_index) {
            for (col_idx, value) in row_patches {
                if *col_idx >= row.len() {
                    row.resize(col_idx + 1, String::new());
                }
                row[*col_idx] = value.clone();
            }
        }
        on_row(output_index, row)?;
        output_index += 1;
        input_index += 1;
    }

    while op_index < normalized_ops.len() {
        if let RowOp::Insert { values, .. } = &normalized_ops[op_index].op {
            let mut row = values.clone();
            apply_column_ops_to_row(&mut row, column_ops);
            if clear_rows.contains(&output_index) {
                for value in row.iter_mut() {
                    *value = String::new();
                }
            } else if !clear_cols.is_empty() {
                for col_idx in clear_cols {
                    if *col_idx >= row.len() {
                        row.resize(*col_idx + 1, String::new());
                    }
                    row[*col_idx] = String::new();
                }
            }
            if let Some(row_patches) = patch_map.get(&output_index) {
                for (col_idx, value) in row_patches {
                    if *col_idx >= row.len() {
                        row.resize(col_idx + 1, String::new());
                    }
                    row[*col_idx] = value.clone();
                }
            }
            on_row(output_index, row)?;
            output_index += 1;
        }
        op_index += 1;
    }

    Ok(headers)
}

struct RunReader {
    reader: csv::Reader<BufReader<File>>,
}

struct HeapItem {
    key: SortKey,
    row: Vec<String>,
    index: usize,
    run_id: usize,
}

impl PartialEq for HeapItem {
    fn eq(&self, other: &Self) -> bool {
        self.key == other.key && self.run_id == other.run_id
    }
}

impl Eq for HeapItem {}

impl PartialOrd for HeapItem {
    fn partial_cmp(&self, other: &Self) -> Option<CmpOrdering> {
        Some(self.cmp(other))
    }
}

impl Ord for HeapItem {
    fn cmp(&self, other: &Self) -> CmpOrdering {
        // Reverse for min-heap behavior
        other
            .key
            .cmp(&self.key)
            .then_with(|| other.run_id.cmp(&self.run_id))
    }
}

fn write_run_file(
    temp_dir: &PathBuf,
    run_id: usize,
    delimiter_byte: u8,
    sort_rules: &[SortRule],
    rows: &mut Vec<(usize, Vec<String>)>,
) -> Result<String, String> {
    rows.sort_by(|a, b| compare_rows(&a.1, &b.1, sort_rules));
    let path = temp_dir.join(format!("nmeditor_run_{}.csv", run_id));
    let mut writer = csv::WriterBuilder::new()
        .has_headers(false)
        .delimiter(delimiter_byte)
        .from_path(&path)
        .map_err(|e| e.to_string())?;

    for (index, row) in rows.iter() {
        let mut record = Vec::with_capacity(row.len() + 1);
        record.push(index.to_string());
        record.extend(row.iter().cloned());
        writer.write_record(&record).map_err(|e| e.to_string())?;
    }

    writer.flush().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn merge_run_files(
    temp_dir: &PathBuf,
    run_paths: &[String],
    delimiter_byte: u8,
    sort_rules: &[SortRule],
) -> Result<(String, usize), String> {
    let output_path = temp_dir.join(format!(
        "nmeditor_view_sorted_{}.csv",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    ));

    let mut writer = csv::WriterBuilder::new()
        .has_headers(false)
        .delimiter(delimiter_byte)
        .from_path(&output_path)
        .map_err(|e| e.to_string())?;

    let mut readers: Vec<RunReader> = Vec::new();
    for path in run_paths {
        let reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .delimiter(delimiter_byte)
            .from_reader(BufReader::new(File::open(path).map_err(|e| e.to_string())?));
        readers.push(RunReader { reader });
    }

    let mut heap = std::collections::BinaryHeap::new();
    for (run_id, run) in readers.iter_mut().enumerate() {
        let mut record = csv::StringRecord::new();
        if run
            .reader
            .read_record(&mut record)
            .map_err(|e| e.to_string())?
        {
            if record.len() == 0 {
                continue;
            }
            let index = record.get(0).unwrap_or("0").parse::<usize>().unwrap_or(0);
            let row: Vec<String> = record.iter().skip(1).map(|s| s.to_string()).collect();
            let key = build_sort_key(&row, sort_rules);
            heap.push(HeapItem {
                key,
                row,
                index,
                run_id,
            });
        }
    }

    let mut total = 0usize;
    while let Some(item) = heap.pop() {
        let mut record = Vec::with_capacity(item.row.len() + 1);
        record.push(item.index.to_string());
        record.extend(item.row.iter().cloned());
        writer.write_record(&record).map_err(|e| e.to_string())?;
        total += 1;

        let run = &mut readers[item.run_id];
        let mut next_record = csv::StringRecord::new();
        if run
            .reader
            .read_record(&mut next_record)
            .map_err(|e| e.to_string())?
        {
            if next_record.len() > 0 {
                let index = next_record
                    .get(0)
                    .unwrap_or("0")
                    .parse::<usize>()
                    .unwrap_or(0);
                let row: Vec<String> = next_record.iter().skip(1).map(|s| s.to_string()).collect();
                let key = build_sort_key(&row, sort_rules);
                heap.push(HeapItem {
                    key,
                    row,
                    index,
                    run_id: item.run_id,
                });
            }
        }
    }

    writer.flush().map_err(|e| e.to_string())?;

    for path in run_paths {
        let _ = fs::remove_file(PathBuf::from(path));
    }

    Ok((output_path.to_string_lossy().to_string(), total))
}

#[tauri::command]
fn save_csv_with_patches(
    path: String,
    target_path: String,
    delimiter: String,
    patches: Vec<CsvPatch>,
    row_ops: Vec<RowOp>,
    column_ops: Vec<ColumnOp>,
    clear_rows: Vec<usize>,
    clear_cols: Vec<usize>,
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
    let patch_map = build_patch_map(&patches);
    let clear_row_set: HashSet<usize> = clear_rows.into_iter().collect();
    let clear_col_set: HashSet<usize> = clear_cols.into_iter().collect();

    let needs_replace = target_path == path;
    let write_target = if needs_replace {
        format!("{}.tmp", path)
    } else {
        target_path.clone()
    };

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter_byte)
        .from_reader(BufReader::new(
            File::open(&path).map_err(|e| e.to_string())?,
        ));

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
        .from_path(&write_target)
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
                    if clear_row_set.contains(&output_index) {
                        for value in row.iter_mut() {
                            *value = String::new();
                        }
                    } else if !clear_col_set.is_empty() {
                        for col_idx in &clear_col_set {
                            if *col_idx >= row.len() {
                                row.resize(*col_idx + 1, String::new());
                            }
                            row[*col_idx] = String::new();
                        }
                    }
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
        if clear_row_set.contains(&output_index) {
            for value in row.iter_mut() {
                *value = String::new();
            }
        } else if !clear_col_set.is_empty() {
            for col_idx in &clear_col_set {
                if *col_idx >= row.len() {
                    row.resize(*col_idx + 1, String::new());
                }
                row[*col_idx] = String::new();
            }
        }
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
            if clear_row_set.contains(&output_index) {
                for value in row.iter_mut() {
                    *value = String::new();
                }
            } else if !clear_col_set.is_empty() {
                for col_idx in &clear_col_set {
                    if *col_idx >= row.len() {
                        row.resize(*col_idx + 1, String::new());
                    }
                    row[*col_idx] = String::new();
                }
            }
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
        rewrite_as_utf16le(&write_target, bom.unwrap_or(false))?;
    } else {
        rewrite_with_utf8_bom(&write_target, bom.unwrap_or(false))?;
    }

    if needs_replace {
        let final_path = PathBuf::from(&path);
        if final_path.exists() {
            fs::remove_file(&final_path).map_err(|e| e.to_string())?;
        }
        fs::rename(&write_target, &final_path).map_err(|e| e.to_string())?;
        return Ok(path);
    }

    Ok(write_target)
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
        .from_reader(BufReader::new(
            File::open(&path).map_err(|e| e.to_string())?,
        ));

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
        .from_reader(BufReader::new(
            File::open(&path).map_err(|e| e.to_string())?,
        ));

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
        .from_reader(BufReader::new(
            File::open(&path).map_err(|e| e.to_string())?,
        ));

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
    let regex_pattern = if spec.regex {
        if spec.match_case {
            spec.find.clone()
        } else {
            format!("(?i){}", spec.find)
        }
    } else {
        String::new()
    };
    let regex = if spec.regex {
        Some(regex::Regex::new(&regex_pattern).map_err(|e| e.to_string())?)
    } else {
        None
    };
    let literal_ci = if !spec.regex && !spec.match_case {
        let escaped = regex::escape(&spec.find);
        Some(
            regex::RegexBuilder::new(&escaped)
                .case_insensitive(true)
                .build()
                .map_err(|e| e.to_string())?,
        )
    } else {
        None
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
            let next = if let Some(re) = &regex {
                re.replace_all(&current, spec.replace.as_str()).to_string()
            } else if spec.match_case {
                current.replace(&spec.find, &spec.replace)
            } else if let Some(ci) = &literal_ci {
                ci.replace_all(&current, spec.replace.as_str()).to_string()
            } else {
                current.clone()
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

fn scan_find_matches_from_path(
    path: &str,
    delimiter_byte: u8,
    has_headers: bool,
    data_col_offset: usize,
    find: &str,
    regex: bool,
    match_case: bool,
    column: Option<usize>,
    start_row: usize,
    end_row: Option<usize>,
    max_matches: usize,
) -> Result<FindMatchesResult, String> {
    let started_at = Instant::now();
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(has_headers)
        .delimiter(delimiter_byte)
        .from_reader(BufReader::new(File::open(path).map_err(|e| e.to_string())?));
    if has_headers {
        reader.headers().map_err(|e| e.to_string())?;
    }

    let regex_pattern = if regex {
        if match_case {
            find.to_string()
        } else {
            format!("(?i){}", find)
        }
    } else {
        String::new()
    };
    let regex_re = if regex {
        Some(regex::Regex::new(&regex_pattern).map_err(|e| e.to_string())?)
    } else {
        None
    };
    let literal_ci = if !regex && !match_case {
        let escaped = regex::escape(find);
        Some(
            regex::RegexBuilder::new(&escaped)
                .case_insensitive(true)
                .build()
                .map_err(|e| e.to_string())?,
        )
    } else {
        None
    };

    let mut matches = Vec::new();
    let mut has_more = false;
    let mut scanned_rows = 0usize;
    for (row_index, record) in reader.records().enumerate() {
        scanned_rows = scanned_rows.saturating_add(1);
        if row_index < start_row {
            continue;
        }
        if let Some(end) = end_row {
            if row_index > end {
                break;
            }
        }

        let record = record.map_err(|e| e.to_string())?;
        let data_cols = record.len().saturating_sub(data_col_offset);
        let columns: Vec<usize> = match column {
            Some(col) => vec![col],
            None => (0..data_cols).collect(),
        };
        for col in columns {
            let storage_col = col + data_col_offset;
            if storage_col >= record.len() {
                continue;
            }
            let value = record.get(storage_col).unwrap_or("");
            let matched = if let Some(re) = &regex_re {
                re.is_match(value)
            } else if match_case {
                value.contains(find)
            } else if let Some(ci) = &literal_ci {
                ci.is_match(value)
            } else {
                false
            };
            if !matched {
                continue;
            }
            matches.push(FindMatchEntry {
                row: row_index,
                col,
                value: value.to_string(),
            });
            if matches.len() > max_matches {
                has_more = true;
                matches.truncate(max_matches);
                break;
            }
        }
        if has_more {
            break;
        }
    }

    Ok(FindMatchesResult {
        matches,
        has_more,
        scanned_rows,
        elapsed_ms: started_at.elapsed().as_millis() as u64,
    })
}

#[tauri::command]
fn find_matches_in_file(
    path: String,
    delimiter: String,
    find: String,
    regex: bool,
    match_case: bool,
    column: Option<usize>,
    start_row: Option<usize>,
    end_row: Option<usize>,
    max_matches: Option<usize>,
) -> Result<FindMatchesResult, String> {
    if find.is_empty() {
        return Err("Find text is required.".to_string());
    }

    let start = start_row.unwrap_or(0);
    if let Some(end) = end_row {
        if end < start {
            return Err("Row range is invalid.".to_string());
        }
    }
    scan_find_matches_from_path(
        &path,
        parse_delimiter(&delimiter),
        true,
        0,
        &find,
        regex,
        match_case,
        column,
        start,
        end_row,
        max_matches.unwrap_or(2000).clamp(1, 20000),
    )
}

#[tauri::command]
fn find_matches_in_global_view(
    state: tauri::State<AppState>,
    view_id: u64,
    find: String,
    regex: bool,
    match_case: bool,
    column: Option<usize>,
    start_row: Option<usize>,
    end_row: Option<usize>,
    max_matches: Option<usize>,
) -> Result<FindMatchesResult, String> {
    if find.is_empty() {
        return Err("Find text is required.".to_string());
    }

    let (temp_path, delimiter) = {
        let views = state.views.lock().map_err(|_| "lock poisoned")?;
        let view = views
            .get(&view_id)
            .ok_or_else(|| "view not found".to_string())?;
        match &view.mode {
            GlobalViewMode::TempFile(path) => (path.clone(), view.delimiter),
        }
    };

    let start = start_row.unwrap_or(0);
    if let Some(end) = end_row {
        if end < start {
            return Err("Row range is invalid.".to_string());
        }
    }
    scan_find_matches_from_path(
        &temp_path,
        delimiter,
        false,
        1,
        &find,
        regex,
        match_case,
        column,
        start,
        end_row,
        max_matches.unwrap_or(2000).clamp(1, 20000),
    )
}

#[tauri::command]
fn start_find_matches_in_file_job(
    state: tauri::State<AppState>,
    path: String,
    delimiter: String,
    find: String,
    regex: bool,
    match_case: bool,
    column: Option<usize>,
    start_row: Option<usize>,
    end_row: Option<usize>,
    max_matches: Option<usize>,
) -> Result<StartFindMatchesResponse, String> {
    if find.is_empty() {
        return Err("Find text is required.".to_string());
    }
    let start = start_row.unwrap_or(0);
    if let Some(end) = end_row {
        if end < start {
            return Err("Row range is invalid.".to_string());
        }
    }

    let delimiter_byte = parse_delimiter(&delimiter);
    let limit = max_matches.unwrap_or(2000).clamp(1, 20000);
    let job_id = state.next_find_job.fetch_add(1, Ordering::Relaxed);
    let cancel_flag = Arc::new(AtomicBool::new(false));

    {
        let mut jobs = state.find_jobs.lock().map_err(|_| "lock poisoned")?;
        prune_find_jobs(&mut jobs);
        jobs.insert(
            job_id,
            FindJob {
                progress: 0.0,
                done: false,
                canceled: false,
                has_more: false,
                matched_count: 0,
                scanned_rows: 0,
                elapsed_ms: 0,
                matches: Vec::new(),
                error: None,
                cancel_flag: cancel_flag.clone(),
            },
        );
    }

    let jobs = state.find_jobs.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let mut scanned_rows = 0usize;
        let mut matched_count = 0usize;
        let result = (|| -> Result<FindMatchesResult, String> {
            let file_len = fs::metadata(&path).map_err(|e| e.to_string())?.len().max(1);
            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .delimiter(delimiter_byte)
                .from_reader(BufReader::new(
                    File::open(&path).map_err(|e| e.to_string())?,
                ));
            reader.headers().map_err(|e| e.to_string())?;

            let regex_pattern = if regex {
                if match_case {
                    find.clone()
                } else {
                    format!("(?i){}", find)
                }
            } else {
                String::new()
            };
            let regex_re = if regex {
                Some(regex::Regex::new(&regex_pattern).map_err(|e| e.to_string())?)
            } else {
                None
            };
            let literal_ci = if !regex && !match_case {
                let escaped = regex::escape(&find);
                Some(
                    regex::RegexBuilder::new(&escaped)
                        .case_insensitive(true)
                        .build()
                        .map_err(|e| e.to_string())?,
                )
            } else {
                None
            };

            let mut matches = Vec::new();
            let mut has_more = false;
            let mut record = csv::StringRecord::new();
            let mut row_index = 0usize;
            let mut last_progress = 0.0f32;
            loop {
                if is_find_job_canceled(&jobs, job_id) {
                    return Err("canceled".to_string());
                }
                if !reader.read_record(&mut record).map_err(|e| e.to_string())? {
                    break;
                }
                scanned_rows = scanned_rows.saturating_add(1);
                if row_index < start {
                    row_index += 1;
                    continue;
                }
                if let Some(end) = end_row {
                    if row_index > end {
                        break;
                    }
                }

                let columns: Vec<usize> = match column {
                    Some(col) => vec![col],
                    None => (0..record.len()).collect(),
                };
                for col in columns {
                    if col >= record.len() {
                        continue;
                    }
                    let value = record.get(col).unwrap_or("");
                    let matched = if let Some(re) = &regex_re {
                        re.is_match(value)
                    } else if match_case {
                        value.contains(&find)
                    } else if let Some(ci) = &literal_ci {
                        ci.is_match(value)
                    } else {
                        false
                    };
                    if !matched {
                        continue;
                    }
                    matches.push(FindMatchEntry {
                        row: row_index,
                        col,
                        value: value.to_string(),
                    });
                    matched_count = matched_count.saturating_add(1);
                    if matches.len() > limit {
                        has_more = true;
                        matches.truncate(limit);
                        break;
                    }
                }
                if has_more {
                    break;
                }

                row_index += 1;
                let progress = (reader.position().byte() as f32 / file_len as f32).clamp(0.0, 0.98);
                if progress - last_progress >= 0.01 {
                    last_progress = progress;
                    update_find_job(&jobs, job_id, |job| {
                        if !job.done {
                            job.progress = progress;
                            job.matched_count = matched_count;
                            job.scanned_rows = scanned_rows;
                        }
                    });
                }
            }
            Ok(FindMatchesResult {
                matches,
                has_more,
                scanned_rows,
                elapsed_ms: started_at.elapsed().as_millis() as u64,
            })
        })();

        match result {
            Ok(data) => {
                update_find_job(&jobs, job_id, |job| {
                    job.progress = 1.0;
                    job.done = true;
                    job.canceled = false;
                    job.has_more = data.has_more;
                    job.matched_count = matched_count.min(data.matches.len());
                    job.scanned_rows = data.scanned_rows;
                    job.elapsed_ms = data.elapsed_ms;
                    job.matches = data.matches;
                    job.error = None;
                });
            }
            Err(err) => {
                if err == "canceled" {
                    update_find_job(&jobs, job_id, |job| {
                        job.done = true;
                        job.canceled = true;
                        job.matched_count = matched_count;
                        job.scanned_rows = scanned_rows;
                        job.elapsed_ms = started_at.elapsed().as_millis() as u64;
                    });
                } else {
                    update_find_job(&jobs, job_id, |job| {
                        job.done = true;
                        job.canceled = false;
                        job.matched_count = matched_count;
                        job.scanned_rows = scanned_rows;
                        job.elapsed_ms = started_at.elapsed().as_millis() as u64;
                        job.error = Some(err);
                    });
                }
            }
        }
    });

    Ok(StartFindMatchesResponse {
        job_id,
        done: false,
    })
}

#[tauri::command]
fn start_find_text_in_file_job(
    state: tauri::State<AppState>,
    path: String,
    find: String,
    regex: bool,
    match_case: bool,
    encoding: Option<String>,
    max_matches: Option<usize>,
) -> Result<StartFindMatchesResponse, String> {
    if find.is_empty() {
        return Err("Find text is required.".to_string());
    }

    let limit = max_matches.unwrap_or(2000).clamp(1, 20000);
    let encoding = encoding.unwrap_or_else(|| "UTF-8".to_string());
    let encoding_kind = parse_text_encoding_kind(&encoding)?;
    if regex
        && matches!(
            encoding_kind,
            TextEncodingKind::Gbk | TextEncodingKind::ShiftJis
        )
    {
        return Err(
            "Regex find for GBK or SHIFT-JIS is not supported yet. Use literal find."
                .to_string(),
        );
    }
    let encoding = encoding_kind.canonical().to_string();
    let job_id = state.next_find_job.fetch_add(1, Ordering::Relaxed);
    let cancel_flag = Arc::new(AtomicBool::new(false));

    {
        let mut jobs = state.find_jobs.lock().map_err(|_| "lock poisoned")?;
        prune_find_jobs(&mut jobs);
        jobs.insert(
            job_id,
            FindJob {
                progress: 0.0,
                done: false,
                canceled: false,
                has_more: false,
                matched_count: 0,
                scanned_rows: 0,
                elapsed_ms: 0,
                matches: Vec::new(),
                error: None,
                cancel_flag: cancel_flag.clone(),
            },
        );
    }

    let jobs = state.find_jobs.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let mut matched_count = 0usize;
        let mut scanned_bytes = 0usize;
        let result = if regex {
            scan_text_regex_matches(
                &path,
                &find,
                match_case,
                &encoding,
                limit,
                || is_find_job_canceled(&jobs, job_id),
                |progress, matched, scanned| {
                    matched_count = matched;
                    scanned_bytes = scanned;
                    update_find_job(&jobs, job_id, |job| {
                        if !job.done {
                            job.progress = progress;
                            job.matched_count = matched_count;
                            job.scanned_rows = scanned_bytes;
                        }
                    });
                },
                |new_matches| {
                    if new_matches.is_empty() {
                        return;
                    }
                    update_find_job(&jobs, job_id, |job| {
                        if job.done {
                            return;
                        }
                        job.matches.extend_from_slice(new_matches);
                    });
                },
            )
        } else {
            scan_text_literal_matches(
                &path,
                &find,
                match_case,
                &encoding,
                limit,
                || is_find_job_canceled(&jobs, job_id),
                |progress, matched, scanned| {
                    matched_count = matched;
                    scanned_bytes = scanned;
                    update_find_job(&jobs, job_id, |job| {
                        if !job.done {
                            job.progress = progress;
                            job.matched_count = matched_count;
                            job.scanned_rows = scanned_bytes;
                        }
                    });
                },
                |new_matches| {
                    if new_matches.is_empty() {
                        return;
                    }
                    update_find_job(&jobs, job_id, |job| {
                        if job.done {
                            return;
                        }
                        job.matches.extend_from_slice(new_matches);
                    });
                },
            )
        };

        match result {
            Ok(data) => {
                update_find_job(&jobs, job_id, |job| {
                    job.progress = 1.0;
                    job.done = true;
                    job.canceled = false;
                    job.has_more = data.has_more;
                    job.matched_count = matched_count.max(data.matches.len());
                    job.scanned_rows = data.scanned_rows;
                    job.elapsed_ms = started_at.elapsed().as_millis() as u64;
                    job.matches = data.matches;
                    job.error = None;
                });
            }
            Err(err) => {
                if err == "canceled" {
                    update_find_job(&jobs, job_id, |job| {
                        job.done = true;
                        job.canceled = true;
                        job.matched_count = matched_count;
                        job.scanned_rows = scanned_bytes;
                        job.elapsed_ms = started_at.elapsed().as_millis() as u64;
                    });
                } else {
                    update_find_job(&jobs, job_id, |job| {
                        job.done = true;
                        job.canceled = false;
                        job.matched_count = matched_count;
                        job.scanned_rows = scanned_bytes;
                        job.elapsed_ms = started_at.elapsed().as_millis() as u64;
                        job.error = Some(err);
                    });
                }
            }
        }
    });

    Ok(StartFindMatchesResponse {
        job_id,
        done: false,
    })
}

#[tauri::command]
fn start_replace_text_in_file_job(
    state: tauri::State<AppState>,
    path: String,
    find: String,
    replace: String,
    regex: bool,
    match_case: bool,
    preserve_case: Option<bool>,
    encoding: Option<String>,
    target_path: Option<String>,
) -> Result<StartFindMatchesResponse, String> {
    if find.is_empty() {
        return Err("Find text is required.".to_string());
    }

    let preserve_case = preserve_case.unwrap_or(false);
    if regex && preserve_case {
        return Err("Preserve case is not supported for regex file replace.".to_string());
    }
    let encoding = encoding.unwrap_or_else(|| "UTF-8".to_string());
    let encoding_kind = parse_text_encoding_kind(&encoding)?;
    if regex
        && matches!(
            encoding_kind,
            TextEncodingKind::Gbk | TextEncodingKind::ShiftJis
        )
    {
        return Err(
            "Regex replace for GBK or SHIFT-JIS is not supported yet. Use literal replace."
                .to_string(),
        );
    }
    let encoding = encoding_kind.canonical().to_string();
    let target = target_path.unwrap_or_else(|| path.clone());
    let job_id = state.next_find_job.fetch_add(1, Ordering::Relaxed);
    let cancel_flag = Arc::new(AtomicBool::new(false));

    {
        let mut jobs = state.find_jobs.lock().map_err(|_| "lock poisoned")?;
        prune_find_jobs(&mut jobs);
        jobs.insert(
            job_id,
            FindJob {
                progress: 0.0,
                done: false,
                canceled: false,
                has_more: false,
                matched_count: 0,
                scanned_rows: 0,
                elapsed_ms: 0,
                matches: Vec::new(),
                error: None,
                cancel_flag: cancel_flag.clone(),
            },
        );
    }

    let jobs = state.find_jobs.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let mut replaced_count = 0usize;
        let mut scanned_bytes = 0usize;
        let result = if regex {
            replace_text_regex_in_file(
                &path,
                &target,
                &find,
                &replace,
                match_case,
                &encoding,
                || is_find_job_canceled(&jobs, job_id),
                |progress, replaced, scanned| {
                    replaced_count = replaced;
                    scanned_bytes = scanned;
                    update_find_job(&jobs, job_id, |job| {
                        if !job.done {
                            job.progress = progress;
                            job.matched_count = replaced_count;
                            job.scanned_rows = scanned_bytes;
                        }
                    });
                },
            )
        } else {
            replace_text_literal_in_file(
                &path,
                &target,
                &find,
                &replace,
                match_case,
                preserve_case,
                &encoding,
                || is_find_job_canceled(&jobs, job_id),
                |progress, replaced, scanned| {
                    replaced_count = replaced;
                    scanned_bytes = scanned;
                    update_find_job(&jobs, job_id, |job| {
                        if !job.done {
                            job.progress = progress;
                            job.matched_count = replaced_count;
                            job.scanned_rows = scanned_bytes;
                        }
                    });
                },
            )
        };

        match result {
            Ok((final_replaced_count, final_scanned_bytes)) => {
                update_find_job(&jobs, job_id, |job| {
                    job.progress = 1.0;
                    job.done = true;
                    job.canceled = false;
                    job.has_more = false;
                    job.matched_count = final_replaced_count;
                    job.scanned_rows = final_scanned_bytes;
                    job.elapsed_ms = started_at.elapsed().as_millis() as u64;
                    job.matches = Vec::new();
                    job.error = None;
                });
            }
            Err(err) => {
                if err == "canceled" {
                    update_find_job(&jobs, job_id, |job| {
                        job.done = true;
                        job.canceled = true;
                        job.matched_count = replaced_count;
                        job.scanned_rows = scanned_bytes;
                        job.elapsed_ms = started_at.elapsed().as_millis() as u64;
                    });
                } else {
                    update_find_job(&jobs, job_id, |job| {
                        job.done = true;
                        job.canceled = false;
                        job.matched_count = replaced_count;
                        job.scanned_rows = scanned_bytes;
                        job.elapsed_ms = started_at.elapsed().as_millis() as u64;
                        job.error = Some(err);
                    });
                }
            }
        }
    });

    Ok(StartFindMatchesResponse {
        job_id,
        done: false,
    })
}

#[tauri::command]
fn start_find_matches_in_global_view_job(
    state: tauri::State<AppState>,
    view_id: u64,
    find: String,
    regex: bool,
    match_case: bool,
    column: Option<usize>,
    start_row: Option<usize>,
    end_row: Option<usize>,
    max_matches: Option<usize>,
) -> Result<StartFindMatchesResponse, String> {
    if find.is_empty() {
        return Err("Find text is required.".to_string());
    }
    let start = start_row.unwrap_or(0);
    if let Some(end) = end_row {
        if end < start {
            return Err("Row range is invalid.".to_string());
        }
    }

    let (temp_path, delimiter) = {
        let views = state.views.lock().map_err(|_| "lock poisoned")?;
        let view = views
            .get(&view_id)
            .ok_or_else(|| "view not found".to_string())?;
        match &view.mode {
            GlobalViewMode::TempFile(path) => (path.clone(), view.delimiter),
        }
    };
    let limit = max_matches.unwrap_or(2000).clamp(1, 20000);
    let job_id = state.next_find_job.fetch_add(1, Ordering::Relaxed);
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut jobs = state.find_jobs.lock().map_err(|_| "lock poisoned")?;
        prune_find_jobs(&mut jobs);
        jobs.insert(
            job_id,
            FindJob {
                progress: 0.0,
                done: false,
                canceled: false,
                has_more: false,
                matched_count: 0,
                scanned_rows: 0,
                elapsed_ms: 0,
                matches: Vec::new(),
                error: None,
                cancel_flag: cancel_flag.clone(),
            },
        );
    }

    let jobs = state.find_jobs.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let mut scanned_rows = 0usize;
        let mut matched_count = 0usize;
        let result = (|| -> Result<FindMatchesResult, String> {
            let file_len = fs::metadata(&temp_path)
                .map_err(|e| e.to_string())?
                .len()
                .max(1);
            let mut reader = csv::ReaderBuilder::new()
                .has_headers(false)
                .delimiter(delimiter)
                .from_reader(BufReader::new(
                    File::open(&temp_path).map_err(|e| e.to_string())?,
                ));

            let regex_pattern = if regex {
                if match_case {
                    find.clone()
                } else {
                    format!("(?i){}", find)
                }
            } else {
                String::new()
            };
            let regex_re = if regex {
                Some(regex::Regex::new(&regex_pattern).map_err(|e| e.to_string())?)
            } else {
                None
            };
            let literal_ci = if !regex && !match_case {
                let escaped = regex::escape(&find);
                Some(
                    regex::RegexBuilder::new(&escaped)
                        .case_insensitive(true)
                        .build()
                        .map_err(|e| e.to_string())?,
                )
            } else {
                None
            };

            let mut matches = Vec::new();
            let mut has_more = false;
            let mut record = csv::StringRecord::new();
            let mut view_row = 0usize;
            let mut last_progress = 0.0f32;
            loop {
                if is_find_job_canceled(&jobs, job_id) {
                    return Err("canceled".to_string());
                }
                if !reader.read_record(&mut record).map_err(|e| e.to_string())? {
                    break;
                }
                scanned_rows = scanned_rows.saturating_add(1);
                if view_row < start {
                    view_row += 1;
                    continue;
                }
                if let Some(end) = end_row {
                    if view_row > end {
                        break;
                    }
                }

                let data_cols = record.len().saturating_sub(1);
                let columns: Vec<usize> = match column {
                    Some(col) => vec![col],
                    None => (0..data_cols).collect(),
                };
                for col in columns {
                    let storage_col = col + 1;
                    if storage_col >= record.len() {
                        continue;
                    }
                    let value = record.get(storage_col).unwrap_or("");
                    let matched = if let Some(re) = &regex_re {
                        re.is_match(value)
                    } else if match_case {
                        value.contains(&find)
                    } else if let Some(ci) = &literal_ci {
                        ci.is_match(value)
                    } else {
                        false
                    };
                    if !matched {
                        continue;
                    }
                    matches.push(FindMatchEntry {
                        row: view_row,
                        col,
                        value: value.to_string(),
                    });
                    matched_count = matched_count.saturating_add(1);
                    if matches.len() > limit {
                        has_more = true;
                        matches.truncate(limit);
                        break;
                    }
                }
                if has_more {
                    break;
                }

                view_row += 1;
                let progress = (reader.position().byte() as f32 / file_len as f32).clamp(0.0, 0.98);
                if progress - last_progress >= 0.01 {
                    last_progress = progress;
                    update_find_job(&jobs, job_id, |job| {
                        if !job.done {
                            job.progress = progress;
                            job.matched_count = matched_count;
                            job.scanned_rows = scanned_rows;
                        }
                    });
                }
            }
            Ok(FindMatchesResult {
                matches,
                has_more,
                scanned_rows,
                elapsed_ms: started_at.elapsed().as_millis() as u64,
            })
        })();

        match result {
            Ok(data) => {
                update_find_job(&jobs, job_id, |job| {
                    job.progress = 1.0;
                    job.done = true;
                    job.canceled = false;
                    job.has_more = data.has_more;
                    job.matched_count = matched_count.min(data.matches.len());
                    job.scanned_rows = data.scanned_rows;
                    job.elapsed_ms = data.elapsed_ms;
                    job.matches = data.matches;
                    job.error = None;
                });
            }
            Err(err) => {
                if err == "canceled" {
                    update_find_job(&jobs, job_id, |job| {
                        job.done = true;
                        job.canceled = true;
                        job.matched_count = matched_count;
                        job.scanned_rows = scanned_rows;
                        job.elapsed_ms = started_at.elapsed().as_millis() as u64;
                    });
                } else {
                    update_find_job(&jobs, job_id, |job| {
                        job.done = true;
                        job.canceled = false;
                        job.matched_count = matched_count;
                        job.scanned_rows = scanned_rows;
                        job.elapsed_ms = started_at.elapsed().as_millis() as u64;
                        job.error = Some(err);
                    });
                }
            }
        }
    });

    Ok(StartFindMatchesResponse {
        job_id,
        done: false,
    })
}

#[tauri::command]
fn get_find_matches_job_status(
    state: tauri::State<AppState>,
    job_id: u64,
    consume_from: Option<usize>,
    consume_limit: Option<usize>,
) -> Result<FindMatchesJobStatus, String> {
    let mut jobs = state.find_jobs.lock().map_err(|_| "lock poisoned")?;
    let job = jobs
        .get(&job_id)
        .ok_or_else(|| "job not found".to_string())?;
    let stream_mode = consume_from.is_some() || consume_limit.is_some();
    let consume_from = consume_from.unwrap_or(0);
    let consume_limit = consume_limit.unwrap_or(400).clamp(1, 10_000);
    let (matches, matches_offset, matches_total) = if stream_mode {
        let total = job.matches.len();
        let start = consume_from.min(total);
        let end = start.saturating_add(consume_limit).min(total);
        (
            Some(job.matches[start..end].to_vec()),
            Some(start),
            Some(total),
        )
    } else if job.done && !job.canceled && job.error.is_none() {
        (Some(job.matches.clone()), Some(0), Some(job.matches.len()))
    } else {
        (None, None, Some(job.matches.len()))
    };
    let status = FindMatchesJobStatus {
        job_id,
        progress: job.progress,
        done: job.done,
        canceled: job.canceled,
        has_more: job.has_more,
        matched_count: job.matched_count,
        scanned_rows: job.scanned_rows,
        elapsed_ms: job.elapsed_ms,
        matches,
        matches_offset,
        matches_total,
        error: job.error.clone(),
    };
    let should_remove = if !status.done {
        false
    } else if !stream_mode {
        true
    } else {
        let delivered = status.matches_offset.unwrap_or(0)
            + status.matches.as_ref().map(|m| m.len()).unwrap_or(0);
        let total = status.matches_total.unwrap_or(0);
        delivered >= total
    };
    if should_remove {
        jobs.remove(&job_id);
    }
    Ok(status)
}

#[tauri::command]
fn cancel_find_matches_job(state: tauri::State<AppState>, job_id: u64) -> Result<bool, String> {
    let jobs = state.find_jobs.lock().map_err(|_| "lock poisoned")?;
    if let Some(job) = jobs.get(&job_id) {
        job.cancel_flag.store(true, Ordering::Relaxed);
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn build_global_view(
    state: tauri::State<AppState>,
    path: String,
    delimiter: String,
    sort_rules: Vec<SortRule>,
    filter_rules: Vec<FilterRule>,
    patches: Vec<CsvPatch>,
    row_ops: Vec<RowOp>,
    column_ops: Vec<ColumnOp>,
    clear_rows: Vec<usize>,
    clear_cols: Vec<usize>,
    memory_limit_mb: Option<u64>,
    force_external_sort: Option<bool>,
) -> Result<GlobalViewResponse, String> {
    let delimiter_byte = parse_delimiter(&delimiter);
    let limit_mb = memory_limit_mb.unwrap_or(300);
    let limit_bytes = limit_mb.saturating_mul(1024 * 1024);
    let force_external_sort = force_external_sort.unwrap_or(false);
    let path_buf = PathBuf::from(&path);
    let file_len = fs::metadata(&path_buf).map_err(|e| e.to_string())?.len();

    let patch_map = build_patch_map(&patches);
    let clear_row_set: HashSet<usize> = clear_rows.into_iter().collect();
    let clear_col_set: HashSet<usize> = clear_cols.into_iter().collect();

    let (mode, total_rows, index_key_for_view) = if (force_external_sort || file_len > limit_bytes)
        && !sort_rules.is_empty()
    {
        let temp_dir = std::env::temp_dir();
        let chunk_limit = (limit_bytes.saturating_mul(60) / 100) as usize;
        let mut chunk: Vec<(usize, Vec<String>)> = Vec::new();
        let mut chunk_bytes = 0usize;
        let mut run_id = 0usize;
        let mut runs: Vec<String> = Vec::new();

        let _ = stream_rows_with_ops(
            &path_buf,
            delimiter_byte,
            &row_ops,
            &column_ops,
            &patch_map,
            &clear_row_set,
            &clear_col_set,
            |row_index, row| {
                if !row_matches_filters(&row, &filter_rules) {
                    return Ok(());
                }
                let row_bytes: usize = row.iter().map(|cell| cell.len() * 2).sum();
                chunk_bytes = chunk_bytes.saturating_add(row_bytes);
                chunk.push((row_index, row));
                if chunk_bytes >= chunk_limit && !chunk.is_empty() {
                    let path =
                        write_run_file(&temp_dir, run_id, delimiter_byte, &sort_rules, &mut chunk)?;
                    runs.push(path);
                    run_id += 1;
                    chunk_bytes = 0;
                    chunk.clear();
                }
                Ok(())
            },
        )?;

        if !chunk.is_empty() {
            let path = write_run_file(&temp_dir, run_id, delimiter_byte, &sort_rules, &mut chunk)?;
            runs.push(path);
        }

        if runs.is_empty() {
            let empty_path = temp_dir.join(format!(
                "nmeditor_view_sorted_empty_{}.csv",
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            ));
            File::create(&empty_path).map_err(|e| e.to_string())?;
            (
                GlobalViewMode::TempFile(empty_path.to_string_lossy().to_string()),
                0,
                Some(index_key(
                    &empty_path.to_string_lossy().to_string(),
                    delimiter_byte,
                )),
            )
        } else {
            let (view_path, total_rows) =
                merge_run_files(&temp_dir, &runs, delimiter_byte, &sort_rules)?;
            let key = index_key(&view_path, delimiter_byte);
            (GlobalViewMode::TempFile(view_path), total_rows, Some(key))
        }
    } else if file_len > limit_bytes && sort_rules.is_empty() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let temp_path = std::env::temp_dir().join(format!("nmeditor_view_{}.csv", stamp));
        let mut writer = csv::WriterBuilder::new()
            .has_headers(false)
            .delimiter(delimiter_byte)
            .from_path(&temp_path)
            .map_err(|e| e.to_string())?;

        let mut kept = 0usize;
        let _ = stream_rows_with_ops(
            &path_buf,
            delimiter_byte,
            &row_ops,
            &column_ops,
            &patch_map,
            &clear_row_set,
            &clear_col_set,
            |row_index, row| {
                if row_matches_filters(&row, &filter_rules) {
                    let mut record = Vec::with_capacity(row.len() + 1);
                    record.push(row_index.to_string());
                    record.extend(row.iter().cloned());
                    writer.write_record(&record).map_err(|e| e.to_string())?;
                    kept += 1;
                }
                Ok(())
            },
        )?;

        writer.flush().map_err(|e| e.to_string())?;
        (
            GlobalViewMode::TempFile(temp_path.to_string_lossy().to_string()),
            kept,
            Some(index_key(
                &temp_path.to_string_lossy().to_string(),
                delimiter_byte,
            )),
        )
    } else {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let temp_path = std::env::temp_dir().join(format!("nmeditor_view_{}.csv", stamp));
        let mut writer = csv::WriterBuilder::new()
            .has_headers(false)
            .delimiter(delimiter_byte)
            .from_path(&temp_path)
            .map_err(|e| e.to_string())?;

        let mut kept = 0usize;
        if sort_rules.is_empty() {
            let _ = stream_rows_with_ops(
                &path_buf,
                delimiter_byte,
                &row_ops,
                &column_ops,
                &patch_map,
                &clear_row_set,
                &clear_col_set,
                |row_index, row| {
                    if row_matches_filters(&row, &filter_rules) {
                        let mut record = Vec::with_capacity(row.len() + 1);
                        record.push(row_index.to_string());
                        record.extend(row.iter().cloned());
                        writer.write_record(&record).map_err(|e| e.to_string())?;
                        kept += 1;
                    }
                    Ok(())
                },
            )?;
        } else {
            let mut paired: Vec<(usize, Vec<String>)> = Vec::new();
            let _ = stream_rows_with_ops(
                &path_buf,
                delimiter_byte,
                &row_ops,
                &column_ops,
                &patch_map,
                &clear_row_set,
                &clear_col_set,
                |row_index, row| {
                    if row_matches_filters(&row, &filter_rules) {
                        paired.push((row_index, row));
                    }
                    Ok(())
                },
            )?;
            paired.sort_by(|a, b| compare_rows(&a.1, &b.1, &sort_rules));
            kept = paired.len();
            for (row_index, row) in paired {
                let mut record = Vec::with_capacity(row.len() + 1);
                record.push(row_index.to_string());
                record.extend(row.into_iter());
                writer.write_record(&record).map_err(|e| e.to_string())?;
            }
        }

        writer.flush().map_err(|e| e.to_string())?;
        (
            GlobalViewMode::TempFile(temp_path.to_string_lossy().to_string()),
            kept,
            Some(index_key(
                &temp_path.to_string_lossy().to_string(),
                delimiter_byte,
            )),
        )
    };

    if let (GlobalViewMode::TempFile(path), Some(idx_key)) = (&mode, &index_key_for_view) {
        let path_buf = PathBuf::from(path);
        if let Ok(index) = build_csv_index_for_file(&path_buf, delimiter_byte, false) {
            if let Ok(mut indexes) = state.indexes.lock() {
                indexes.insert(idx_key.clone(), Arc::new(index));
                prune_index_cache(&mut indexes);
            }
        }
    }

    let view_id = state.next_view_id.fetch_add(1, Ordering::Relaxed);
    let mut views = state.views.lock().map_err(|_| "lock poisoned")?;
    views.insert(
        view_id,
        GlobalView {
            mode,
            delimiter: delimiter_byte,
            index_key: index_key_for_view,
        },
    );
    let mut stale_temp_files: Vec<String> = Vec::new();
    let mut stale_index_keys: Vec<String> = Vec::new();
    if views.len() > MAX_GLOBAL_VIEW_ENTRIES {
        let mut ids: Vec<u64> = views.keys().copied().collect();
        ids.sort_unstable();
        let mut remove_count = views.len() - MAX_GLOBAL_VIEW_ENTRIES;
        for id in ids {
            if remove_count == 0 {
                break;
            }
            if id == view_id {
                continue;
            }
            if let Some(stale) = views.remove(&id) {
                let GlobalViewMode::TempFile(path) = stale.mode;
                stale_temp_files.push(path);
                if let Some(key) = stale.index_key {
                    stale_index_keys.push(key);
                }
            }
            remove_count -= 1;
        }
    }
    drop(views);
    if !stale_index_keys.is_empty() {
        if let Ok(mut indexes) = state.indexes.lock() {
            for key in stale_index_keys {
                indexes.remove(&key);
            }
        }
    }
    for path in stale_temp_files {
        let _ = fs::remove_file(PathBuf::from(path));
    }

    Ok(GlobalViewResponse {
        view_id,
        total_rows,
    })
}

#[tauri::command]
fn read_global_view_rows(
    state: tauri::State<AppState>,
    view_id: u64,
    start: usize,
    limit: usize,
) -> Result<CsvSlice, String> {
    let views = state.views.lock().map_err(|_| "lock poisoned")?;
    let view = views
        .get(&view_id)
        .ok_or_else(|| "view not found".to_string())?;

    let (temp_path, delimiter) = match &view.mode {
        GlobalViewMode::TempFile(path) => (path.clone(), view.delimiter),
    };
    drop(views);
    let mut slice = read_csv_rows_window_internal(
        &state,
        temp_path,
        Some(delimiter_to_string(delimiter)),
        start,
        limit,
        false,
    )?;
    let mut indices: Vec<usize> = Vec::with_capacity(slice.rows.len());
    for row in slice.rows.iter_mut() {
        if row.is_empty() {
            indices.push(0);
            continue;
        }
        let raw = row.remove(0);
        indices.push(raw.parse::<usize>().unwrap_or(0));
    }
    slice.row_indices = Some(indices);
    Ok(slice)
}

#[tauri::command]
fn list_column_value_counts(
    state: tauri::State<AppState>,
    path: Option<String>,
    delimiter: Option<String>,
    view_id: Option<u64>,
    column: usize,
    query: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
    patches: Option<Vec<CsvPatch>>,
    row_ops: Option<Vec<RowOp>>,
    column_ops: Option<Vec<ColumnOp>>,
    clear_rows: Option<Vec<usize>>,
    clear_cols: Option<Vec<usize>>,
) -> Result<ColumnValueCountsResult, String> {
    const MAX_DISTINCT_TRACKED: usize = 50_000;

    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut truncated = false;
    let mut scanned_rows = 0usize;
    let query_lower = query.unwrap_or_default().trim().to_lowercase();
    let has_query = !query_lower.is_empty();

    let mut push_value = |value: String| {
        if has_query && !value.to_lowercase().contains(&query_lower) {
            return;
        }
        if let Some(entry) = counts.get_mut(&value) {
            *entry += 1;
            return;
        }
        if counts.len() >= MAX_DISTINCT_TRACKED {
            truncated = true;
            return;
        }
        counts.insert(value, 1);
    };

    if let Some(view_id) = view_id {
        let views = state.views.lock().map_err(|_| "lock poisoned")?;
        let view = views
            .get(&view_id)
            .ok_or_else(|| "view not found".to_string())?;
        let (temp_path, delimiter_byte) = match &view.mode {
            GlobalViewMode::TempFile(path) => (path.clone(), view.delimiter),
        };
        drop(views);

        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .delimiter(delimiter_byte)
            .from_reader(BufReader::new(
                File::open(PathBuf::from(temp_path)).map_err(|e| e.to_string())?,
            ));
        for record in reader.records() {
            let record = record.map_err(|e| e.to_string())?;
            scanned_rows += 1;
            let value = record.get(column + 1).unwrap_or("").to_string();
            push_value(value);
        }
    } else {
        let path = path.ok_or_else(|| "path is required when view_id is missing".to_string())?;
        let path_buf = PathBuf::from(path);
        let delimiter_byte = parse_delimiter(delimiter.as_deref().unwrap_or(","));
        let patch_map = build_patch_map(&patches.unwrap_or_default());
        let row_ops = row_ops.unwrap_or_default();
        let column_ops = column_ops.unwrap_or_default();
        let clear_rows: HashSet<usize> = clear_rows.unwrap_or_default().into_iter().collect();
        let clear_cols: HashSet<usize> = clear_cols.unwrap_or_default().into_iter().collect();

        stream_rows_with_ops(
            &path_buf,
            delimiter_byte,
            &row_ops,
            &column_ops,
            &patch_map,
            &clear_rows,
            &clear_cols,
            |_, row| {
                scanned_rows += 1;
                let value = row.get(column).cloned().unwrap_or_default();
                push_value(value);
                Ok(())
            },
        )?;
    }

    let mut values: Vec<ColumnValueCount> = counts
        .into_iter()
        .map(|(value, count)| ColumnValueCount { value, count })
        .collect();
    values.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.value.cmp(&b.value)));

    let safe_limit = limit.unwrap_or(120).clamp(1, 1000);
    let safe_offset = offset.unwrap_or(0);
    let total = values.len();
    let has_more = safe_offset + safe_limit < total;
    let values = values
        .into_iter()
        .skip(safe_offset)
        .take(safe_limit)
        .collect::<Vec<_>>();

    Ok(ColumnValueCountsResult {
        values,
        has_more,
        truncated,
        scanned_rows,
    })
}

#[tauri::command]
fn release_global_view(state: tauri::State<AppState>, view_id: u64) -> Result<bool, String> {
    let view = {
        let mut views = state.views.lock().map_err(|_| "lock poisoned")?;
        views.remove(&view_id)
    };

    if let Some(view) = view {
        let GlobalViewMode::TempFile(path) = view.mode;
        if let Some(key) = view.index_key {
            if let Ok(mut indexes) = state.indexes.lock() {
                indexes.remove(&key);
            }
        }
        let _ = fs::remove_file(PathBuf::from(path));
        return Ok(true);
    }

    Ok(false)
}

#[tauri::command]
fn recover_replace_journals() -> Result<usize, String> {
    recover_pending_replace_journals()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
            indexes: Arc::new(Mutex::new(HashMap::new())),
            index_jobs: Arc::new(Mutex::new(HashMap::new())),
            next_index_job: AtomicU64::new(1),
            find_jobs: Arc::new(Mutex::new(HashMap::new())),
            next_find_job: AtomicU64::new(1),
            views: Mutex::new(HashMap::new()),
            next_view_id: AtomicU64::new(1),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if let Err(err) = recover_pending_replace_journals() {
                eprintln!("recover replace journals failed: {}", err);
            }
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
            read_file_head_bytes,
            read_file_bytes_range,
            encode_text_with_encoding,
            replace_file_bytes_range,
            start_prepare_csv_index,
            get_prepare_csv_index_status,
            cancel_prepare_csv_index,
            count_csv_rows,
            close_csv_session,
            save_csv_with_patches,
            apply_macro_to_file,
            compute_column_stats,
            apply_find_replace_to_file,
            find_matches_in_file,
            find_matches_in_global_view,
            start_find_matches_in_file_job,
            start_find_text_in_file_job,
            start_replace_text_in_file_job,
            start_find_matches_in_global_view_job,
            get_find_matches_job_status,
            cancel_find_matches_job,
            build_global_view,
            read_global_view_rows,
            list_column_value_counts,
            release_global_view,
            recover_replace_journals,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufWriter, Write};

    fn make_test_state() -> AppState {
        AppState {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
            indexes: Arc::new(Mutex::new(HashMap::new())),
            index_jobs: Arc::new(Mutex::new(HashMap::new())),
            next_index_job: AtomicU64::new(1),
            find_jobs: Arc::new(Mutex::new(HashMap::new())),
            next_find_job: AtomicU64::new(1),
            views: Mutex::new(HashMap::new()),
            next_view_id: AtomicU64::new(1),
        }
    }

    fn temp_csv_path(tag: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        std::env::temp_dir().join(format!(
            "deskcsv_{}_{}_{}.csv",
            tag,
            std::process::id(),
            stamp
        ))
    }

    fn temp_journal_dir(tag: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        std::env::temp_dir().join(format!(
            "deskcsv_journal_{}_{}_{}",
            tag,
            std::process::id(),
            stamp
        ))
    }

    fn write_large_test_csv(path: &PathBuf, rows: usize, cols: usize) -> Result<(), String> {
        let file = File::create(path).map_err(|e| e.to_string())?;
        let mut writer = BufWriter::new(file);
        let headers = (0..cols).map(|c| format!("c{}", c)).collect::<Vec<_>>();
        writeln!(writer, "{}", headers.join(",")).map_err(|e| e.to_string())?;
        for row in 0..rows {
            let mut values = Vec::with_capacity(cols);
            for col in 0..cols {
                let value = match col {
                    0 => format!("id_{}", row),
                    1 => {
                        if row % 97 == 0 {
                            "needle".to_string()
                        } else {
                            format!("v{}", row % 1000)
                        }
                    }
                    2 => format!("{}", (row * 17) % 100_000),
                    _ => format!("r{}_c{}", row, col),
                };
                values.push(value);
            }
            writeln!(writer, "{}", values.join(",")).map_err(|e| e.to_string())?;
        }
        writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    fn write_view_csv(path: &PathBuf) -> Result<(), String> {
        let file = File::create(path).map_err(|e| e.to_string())?;
        let mut writer = BufWriter::new(file);
        // Global view temp format: [original_row_index, data_col0, data_col1, ...]
        writeln!(writer, "needle_in_index,alpha,beta").map_err(|e| e.to_string())?;
        writeln!(writer, "idx2,needle_data,beta").map_err(|e| e.to_string())?;
        writeln!(writer, "idx3,alpha,beta").map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[test]
    fn row_matches_filters_supports_in_json_multi_values() {
        let row = vec!["alpha".to_string(), "banana".to_string()];
        let filters = vec![FilterRule {
            column: 1,
            value: r#"@in-json:["apple","banana"]"#.to_string(),
        }];
        assert!(row_matches_filters(&row, &filters));

        let miss = vec![FilterRule {
            column: 1,
            value: r#"@in-json:["apple","cherry"]"#.to_string(),
        }];
        assert!(!row_matches_filters(&row, &miss));
    }

    #[test]
    fn large_csv_window_reads_cover_eof_edges() {
        let path = temp_csv_path("window");
        write_large_test_csv(&path, 20_000, 8).expect("create csv");
        let state = make_test_state();
        let path_str = path.to_string_lossy().to_string();

        let first = read_csv_rows_window_internal(
            &state,
            path_str.clone(),
            Some(",".to_string()),
            0,
            500,
            true,
        )
        .expect("first window");
        assert_eq!(first.rows.len(), 500);
        assert!(!first.eof);

        let near_end = read_csv_rows_window_internal(
            &state,
            path_str.clone(),
            Some(",".to_string()),
            19_950,
            500,
            true,
        )
        .expect("near end window");
        assert_eq!(near_end.rows.len(), 50);
        assert!(near_end.eof);
        assert_eq!(near_end.rows[0][0], "id_19950");

        let past_end = read_csv_rows_window_internal(
            &state,
            path_str,
            Some(",".to_string()),
            20_000,
            500,
            true,
        )
        .expect("past end window");
        assert_eq!(past_end.rows.len(), 0);
        assert!(past_end.eof);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn large_csv_find_match_cap_sets_has_more() {
        let path = temp_csv_path("find_cap");
        write_large_test_csv(&path, 30_000, 6).expect("create csv");

        let result = find_matches_in_file(
            path.to_string_lossy().to_string(),
            ",".to_string(),
            "needle".to_string(),
            false,
            false,
            None,
            Some(0),
            None,
            Some(100),
        )
        .expect("find matches");

        assert_eq!(result.matches.len(), 100);
        assert!(result.has_more);
        assert!(result.scanned_rows >= 100);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn large_csv_view_find_ignores_original_index_column() {
        let path = temp_csv_path("view_find");
        write_view_csv(&path).expect("create view csv");

        let result = scan_find_matches_from_path(
            &path.to_string_lossy(),
            b',',
            false,
            1,
            "needle",
            false,
            false,
            None,
            0,
            None,
            100,
        )
        .expect("scan view");

        assert_eq!(result.matches.len(), 1);
        assert_eq!(result.matches[0].row, 1);
        assert_eq!(result.matches[0].col, 0);
        assert_eq!(result.matches[0].value, "needle_data");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn replace_file_bytes_range_supports_in_place_and_save_as() {
        let source = temp_csv_path("text_patch_src");
        let target = temp_csv_path("text_patch_out");

        fs::write(&source, b"0123456789").expect("write source");
        replace_file_bytes_range(
            source.to_string_lossy().to_string(),
            source.to_string_lossy().to_string(),
            3,
            4,
            b"ABCD".to_vec(),
        )
        .expect("in-place replace");
        let in_place = fs::read(&source).expect("read in-place");
        assert_eq!(in_place, b"012ABCD789");

        replace_file_bytes_range(
            source.to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
            2,
            3,
            b"xy".to_vec(),
        )
        .expect("save-as replace");
        let save_as = fs::read(&target).expect("read save-as");
        assert_eq!(save_as, b"01xyCD789");

        let _ = fs::remove_file(source);
        let _ = fs::remove_file(target);
    }

    #[test]
    fn replace_text_literal_in_file_supports_utf8_streaming() {
        let source = temp_csv_path("text_replace_utf8_src");
        let target = temp_csv_path("text_replace_utf8_out");
        fs::write(&source, "alpha beta alpha\n").expect("write utf8 source");

        let (replaced, scanned) = replace_text_literal_in_file(
            &source.to_string_lossy(),
            &target.to_string_lossy(),
            "alpha",
            "X",
            true,
            false,
            "UTF-8",
            || false,
            |_, _, _| {},
        )
        .expect("replace utf8");

        assert_eq!(replaced, 2);
        assert!(scanned > 0);
        let output = fs::read_to_string(&target).expect("read utf8 target");
        assert_eq!(output, "X beta X\n");

        let _ = fs::remove_file(source);
        let _ = fs::remove_file(target);
    }

    #[test]
    fn replace_text_literal_in_file_preserves_case_pattern() {
        let source = temp_csv_path("text_replace_case_src");
        let target = temp_csv_path("text_replace_case_out");
        fs::write(&source, "alpha ALPHA Alpha aLpHa\n").expect("write source");

        let (replaced, scanned) = replace_text_literal_in_file(
            &source.to_string_lossy(),
            &target.to_string_lossy(),
            "alpha",
            "beta",
            false,
            true,
            "UTF-8",
            || false,
            |_, _, _| {},
        )
        .expect("replace preserve case");

        assert_eq!(replaced, 4);
        assert!(scanned > 0);
        let output = fs::read_to_string(&target).expect("read target");
        assert_eq!(output, "beta BETA Beta beta\n");

        let _ = fs::remove_file(source);
        let _ = fs::remove_file(target);
    }

    #[test]
    fn replace_text_literal_in_file_supports_utf16le_in_place() {
        let source = temp_csv_path("text_replace_utf16_src");
        let mut bytes = vec![0xFF, 0xFE];
        for unit in "xx猫xx猫".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }
        fs::write(&source, bytes).expect("write utf16 source");

        let (replaced, scanned) = replace_text_literal_in_file(
            &source.to_string_lossy(),
            &source.to_string_lossy(),
            "猫",
            "犬",
            true,
            false,
            "UTF-16LE",
            || false,
            |_, _, _| {},
        )
        .expect("replace utf16");

        assert_eq!(replaced, 2);
        assert!(scanned > 0);
        let output_bytes = fs::read(&source).expect("read utf16 target");
        assert!(output_bytes.starts_with(&[0xFF, 0xFE]));
        let mut units = Vec::new();
        let mut idx = 2usize;
        while idx + 1 < output_bytes.len() {
            units.push(u16::from_le_bytes([
                output_bytes[idx],
                output_bytes[idx + 1],
            ]));
            idx += 2;
        }
        let output = String::from_utf16(&units).expect("decode utf16 output");
        assert_eq!(output, "xx犬xx犬");

        let _ = fs::remove_file(source);
    }

    #[test]
    fn replace_text_regex_in_file_supports_utf8_capture_groups() {
        let source = temp_csv_path("text_replace_regex_utf8_src");
        let target = temp_csv_path("text_replace_regex_utf8_out");
        fs::write(&source, "abc-12 abc-3\n").expect("write utf8 source");

        let (replaced, scanned) = replace_text_regex_in_file(
            &source.to_string_lossy(),
            &target.to_string_lossy(),
            r"abc-(\d+)",
            "[$1]",
            true,
            "UTF-8",
            || false,
            |_, _, _| {},
        )
        .expect("replace regex utf8");

        assert_eq!(replaced, 2);
        assert!(scanned > 0);
        let output = fs::read_to_string(&target).expect("read utf8 target");
        assert_eq!(output, "[12] [3]\n");

        let _ = fs::remove_file(source);
        let _ = fs::remove_file(target);
    }

    #[test]
    fn replace_text_regex_in_file_supports_utf16le_capture_groups() {
        let source = temp_csv_path("text_replace_regex_utf16_src");
        let mut bytes = vec![0xFF, 0xFE];
        for unit in "猫1 猫2".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }
        fs::write(&source, bytes).expect("write utf16 source");

        let (replaced, scanned) = replace_text_regex_in_file(
            &source.to_string_lossy(),
            &source.to_string_lossy(),
            r"猫(\d)",
            "犬$1",
            true,
            "UTF-16LE",
            || false,
            |_, _, _| {},
        )
        .expect("replace regex utf16");

        assert_eq!(replaced, 2);
        assert!(scanned > 0);
        let output_bytes = fs::read(&source).expect("read utf16 target");
        assert!(output_bytes.starts_with(&[0xFF, 0xFE]));
        let mut units = Vec::new();
        let mut idx = 2usize;
        while idx + 1 < output_bytes.len() {
            units.push(u16::from_le_bytes([
                output_bytes[idx],
                output_bytes[idx + 1],
            ]));
            idx += 2;
        }
        let output = String::from_utf16(&units).expect("decode utf16 output");
        assert_eq!(output, "犬1 犬2");

        let _ = fs::remove_file(source);
    }

    #[test]
    fn recover_pending_replace_journals_restores_backup_when_target_missing() {
        let journal_dir = temp_journal_dir("recover_backup");
        fs::create_dir_all(&journal_dir).expect("create journal dir");
        let target = journal_dir.join("restore_target.txt");
        let temp = journal_dir.join("replace.tmp");
        let backup = journal_dir.join("replace.bak");
        fs::write(&temp, "new value").expect("write temp");
        fs::write(&backup, "original value").expect("write backup");

        let journal = ReplaceJournalRecord {
            version: 1,
            op: "replace_text_literal_in_file".to_string(),
            created_at_ms: now_ms(),
            target_path: target.to_string_lossy().to_string(),
            temp_path: temp.to_string_lossy().to_string(),
            backup_path: backup.to_string_lossy().to_string(),
        };
        let journal_path = journal_dir.join(format!(
            "{}{}_test.json",
            REPLACE_JOURNAL_FILE_PREFIX,
            std::process::id()
        ));
        fs::write(
            &journal_path,
            serde_json::to_vec(&journal).expect("encode journal"),
        )
        .expect("write journal");

        let recovered =
            recover_pending_replace_journals_in_dir(&journal_dir).expect("recover journals");
        assert_eq!(recovered, 1);
        let content = fs::read_to_string(&target).expect("read restored target");
        assert_eq!(content, "original value");
        assert!(!journal_path.exists());
        assert!(!temp.exists());
        assert!(!backup.exists());

        let _ = fs::remove_file(target);
        let _ = fs::remove_dir_all(journal_dir);
    }

    #[test]
    fn scan_text_literal_matches_supports_utf8_and_utf16le() {
        let utf8_path = temp_csv_path("text_find_utf8");
        fs::write(&utf8_path, "alpha beta alpha\n").expect("write utf8");
        let utf8 = scan_text_literal_matches(
            &utf8_path.to_string_lossy(),
            "alpha",
            true,
            "UTF-8",
            100,
            || false,
            |_, _, _| {},
            |_| {},
        )
        .expect("scan utf8");
        assert_eq!(utf8.matches.len(), 2);
        assert_eq!(utf8.matches[0].row, 0);
        assert_eq!(utf8.matches[1].row, 11);

        let utf16_path = temp_csv_path("text_find_utf16");
        let mut bytes = vec![0xFF, 0xFE];
        for unit in "xx猫xx猫".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }
        fs::write(&utf16_path, bytes).expect("write utf16");
        let utf16 = scan_text_literal_matches(
            &utf16_path.to_string_lossy(),
            "猫",
            true,
            "UTF-16LE",
            100,
            || false,
            |_, _, _| {},
            |_| {},
        )
        .expect("scan utf16");
        assert_eq!(utf16.matches.len(), 2);
        assert!(utf16.matches.iter().all(|m| m.row % 2 == 0));
        assert!(utf16.matches[0].row >= 2);

        let _ = fs::remove_file(utf8_path);
        let _ = fs::remove_file(utf16_path);
    }

    #[test]
    fn scan_text_regex_matches_supports_utf8_and_utf16le() {
        let utf8_path = temp_csv_path("text_find_regex_utf8");
        fs::write(&utf8_path, "abc-123\nabc-456\n").expect("write utf8");
        let utf8 = scan_text_regex_matches(
            &utf8_path.to_string_lossy(),
            r"abc-\d+",
            true,
            "UTF-8",
            100,
            || false,
            |_, _, _| {},
            |_| {},
        )
        .expect("scan regex utf8");
        assert_eq!(utf8.matches.len(), 2);
        assert_eq!(utf8.matches[0].row, 0);
        let utf8_cross = scan_text_regex_matches(
            &utf8_path.to_string_lossy(),
            "123\\nabc",
            true,
            "UTF-8",
            100,
            || false,
            |_, _, _| {},
            |_| {},
        )
        .expect("scan regex utf8 cross-line");
        assert_eq!(utf8_cross.matches.len(), 1);
        assert_eq!(utf8_cross.matches[0].row, 4);

        let utf16_path = temp_csv_path("text_find_regex_utf16");
        let mut bytes = vec![0xFF, 0xFE];
        for unit in "abc-123\nabc-789".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }
        fs::write(&utf16_path, bytes).expect("write utf16");
        let utf16 = scan_text_regex_matches(
            &utf16_path.to_string_lossy(),
            r"abc-\d+",
            true,
            "UTF-16LE",
            100,
            || false,
            |_, _, _| {},
            |_| {},
        )
        .expect("scan regex utf16");
        assert_eq!(utf16.matches.len(), 2);
        assert!(utf16.matches.iter().all(|m| m.row % 2 == 0));
        assert!(utf16.matches[0].row >= 2);
        let utf16_cross = scan_text_regex_matches(
            &utf16_path.to_string_lossy(),
            "123\\nabc",
            true,
            "UTF-16LE",
            100,
            || false,
            |_, _, _| {},
            |_| {},
        )
        .expect("scan regex utf16 cross-line");
        assert_eq!(utf16_cross.matches.len(), 1);
        assert!(utf16_cross.matches[0].row >= 10);

        let _ = fs::remove_file(utf8_path);
        let _ = fs::remove_file(utf16_path);
    }
}
