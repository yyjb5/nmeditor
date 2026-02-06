use serde::{Deserialize, Serialize};
use std::cmp::Ordering as CmpOrdering;
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufReader, Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
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
    let file_save = MenuItemBuilder::with_id("file_save", if zh { "保存" } else { "Save" })
        .accelerator("CmdOrCtrl+S")
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
    Duplicate { index: usize, from: usize, name: String },
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
                (Some(a_num), Some(b_num)) => a_num.partial_cmp(&b_num).unwrap_or(CmpOrdering::Equal),
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

static MENU_EVENT_GUARD: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();

const INDEX_STRIDE: usize = 1000;
const MAX_INDEX_CACHE_ENTRIES: usize = 12;
const MAX_GLOBAL_VIEW_ENTRIES: usize = 6;
const MAX_INDEX_JOB_ENTRIES: usize = 64;

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

fn file_signature(path: &PathBuf) -> Result<(u64, u64), String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or_else(|| SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs());
    Ok((metadata.len(), modified))
}

fn update_index_job(jobs: &Arc<Mutex<HashMap<u64, IndexJob>>>, job_id: u64, update: impl FnOnce(&mut IndexJob)) {
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
                .from_reader(BufReader::new(File::open(&path_buf).map_err(|e| e.to_string())?));

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
fn cancel_prepare_csv_index(
    state: tauri::State<AppState>,
    job_id: u64,
) -> Result<bool, String> {
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
        file.seek(SeekFrom::Start(base_offset)).map_err(|e| e.to_string())?;
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
            current += 1;
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
        .from_reader(BufReader::new(File::open(&path_buf).map_err(|e| e.to_string())?));

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
                let source = if *from < row.len() { row[*from].clone() } else { String::new() };
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
    for rule in filters {
        if rule.value.is_empty() {
            continue;
        }
        if rule.column >= row.len() {
            return false;
        }
        if !row[rule.column].contains(&rule.value) {
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
            (Ok(a_num), Ok(b_num)) => a_num
                .partial_cmp(&b_num)
                .unwrap_or(CmpOrdering::Equal),
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
) -> Result<GlobalViewResponse, String> {
    let delimiter_byte = parse_delimiter(&delimiter);
    let limit_mb = memory_limit_mb.unwrap_or(300);
    let limit_bytes = limit_mb.saturating_mul(1024 * 1024);
    let path_buf = PathBuf::from(&path);
    let file_len = fs::metadata(&path_buf).map_err(|e| e.to_string())?.len();

    let patch_map = build_patch_map(&patches);
    let clear_row_set: HashSet<usize> = clear_rows.into_iter().collect();
    let clear_col_set: HashSet<usize> = clear_cols.into_iter().collect();

    let (mode, total_rows, index_key_for_view) = if file_len > limit_bytes && !sort_rules.is_empty() {
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
                    let path = write_run_file(&temp_dir, run_id, delimiter_byte, &sort_rules, &mut chunk)?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
            indexes: Arc::new(Mutex::new(HashMap::new())),
            index_jobs: Arc::new(Mutex::new(HashMap::new())),
            next_index_job: AtomicU64::new(1),
            views: Mutex::new(HashMap::new()),
            next_view_id: AtomicU64::new(1),
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
            start_prepare_csv_index,
            get_prepare_csv_index_status,
            cancel_prepare_csv_index,
            count_csv_rows,
            close_csv_session,
            save_csv_with_patches,
            apply_macro_to_file,
            compute_column_stats,
            apply_find_replace_to_file,
            build_global_view,
            read_global_view_rows,
            release_global_view,
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
