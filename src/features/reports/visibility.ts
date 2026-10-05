const STORAGE_KEY = 'usp-map:reports';

/** Whether temporary reports are drawn; on unless the user switched them off on this device. */
export function readReportsVisible(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function storeReportsVisible(visible: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, visible ? 'on' : 'off');
  } catch {
    // Private browsing: the choice just lasts for this visit.
  }
}
