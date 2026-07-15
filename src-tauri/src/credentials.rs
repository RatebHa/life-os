use keyring::Entry;

pub(crate) const SERVICE_NAME: &str = "com.lifeos.app";

fn entry_for(service: &str, key: &str) -> Result<Entry, String> {
    Entry::new(service, key).map_err(|e| e.to_string())
}

pub(crate) fn get_secret_from(service: &str, key: &str) -> Result<Option<String>, String> {
    match entry_for(service, key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub(crate) fn set_secret_in(service: &str, key: &str, value: &str) -> Result<(), String> {
    entry_for(service, key)?.set_password(value).map_err(|e| e.to_string())
}

pub(crate) fn delete_secret_from(service: &str, key: &str) -> Result<(), String> {
    match entry_for(service, key)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn get_secret(key: &str) -> Result<Option<String>, String> {
    get_secret_from(SERVICE_NAME, key)
}

pub fn set_secret(key: &str, value: &str) -> Result<(), String> {
    set_secret_in(SERVICE_NAME, key, value)
}

pub fn delete_secret(key: &str) -> Result<(), String> {
    delete_secret_from(SERVICE_NAME, key)
}

// Test-only lock serializing every keychain-touching test across the crate
// (this module and `commands::credential_migration_tests`). `keyring-core`'s
// default credential-store selection is lazily initialized and not safe
// against concurrent first-use from multiple threads; Rust's test runner
// gives each `#[test]` its own thread, so without this lock these tests can
// race each other and intermittently fail with "No default store has been
// set, so cannot search or create entries". Every other (non-keychain) test
// in the crate is unaffected and keeps running fully in parallel.
#[cfg(test)]
pub(crate) static KEYRING_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SERVICE_NAME: &str = "com.lifeos.app.test";

    #[test]
    fn round_trips_a_secret_through_the_os_credential_store() {
        let _guard = KEYRING_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let key = "round_trip_test_key";
        let _ = delete_secret_from(TEST_SERVICE_NAME, key);

        assert_eq!(get_secret_from(TEST_SERVICE_NAME, key).unwrap(), None);

        set_secret_in(TEST_SERVICE_NAME, key, "s3cr3t-value").unwrap();
        assert_eq!(
            get_secret_from(TEST_SERVICE_NAME, key).unwrap(),
            Some("s3cr3t-value".to_string())
        );

        delete_secret_from(TEST_SERVICE_NAME, key).unwrap();
        assert_eq!(get_secret_from(TEST_SERVICE_NAME, key).unwrap(), None);
    }
}
