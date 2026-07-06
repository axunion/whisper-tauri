/// Returns the inclusive start-of-day timestamp for a `YYYY-MM-DD` date.
#[must_use]
pub(crate) fn day_start(date: &str) -> String {
    format!("{date}T00:00:00")
}

/// Returns the inclusive end-of-day timestamp for a `YYYY-MM-DD` date.
#[must_use]
pub(crate) fn day_end(date: &str) -> String {
    format!("{date}T23:59:59")
}

/// Returns the current time as an ISO 8601 string (local time, no timezone suffix).
#[must_use]
pub(crate) fn chrono_now() -> String {
    use std::time::SystemTime;

    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();

    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    let (year, month, day) = days_to_date(days);

    format!("{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}")
}

/// Converts days since Unix epoch to (year, month, day).
fn days_to_date(days: u64) -> (u64, u64, u64) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719_468;
    let era = z / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn day_start_and_day_end_wrap_date() {
        assert_eq!(day_start("2026-02-20"), "2026-02-20T00:00:00");
        assert_eq!(day_end("2026-02-20"), "2026-02-20T23:59:59");
    }

    #[test]
    fn chrono_now_returns_iso8601_like_format() {
        let s = chrono_now();
        assert_eq!(s.len(), 19);
        assert_eq!(s.chars().nth(4), Some('-'));
        assert_eq!(s.chars().nth(7), Some('-'));
        assert_eq!(s.chars().nth(10), Some('T'));
        assert_eq!(s.chars().nth(13), Some(':'));
        assert_eq!(s.chars().nth(16), Some(':'));
    }

    #[test]
    fn days_to_date_unix_epoch() {
        assert_eq!(days_to_date(0), (1970, 1, 1));
    }

    #[test]
    fn days_to_date_known_dates() {
        // 2000-01-01 is 10957 days after 1970-01-01
        assert_eq!(days_to_date(10957), (2000, 1, 1));
        // 2024-02-29 (leap day)
        assert_eq!(days_to_date(19782), (2024, 2, 29));
    }
}
