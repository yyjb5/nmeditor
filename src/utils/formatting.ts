/**
 * Formatting Utilities
 * 
 * Common formatting functions used across the application.
 */

/**
 * Format byte size to human-readable string
 * @param bytes - Number of bytes to format
 * @returns Formatted string (e.g., "1.5 MB")
 */
export const formatByteSize = (bytes: number | null): string => {
    if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "-";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    const precision = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
};
