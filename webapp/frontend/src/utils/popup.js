let popupCallback = null

export const registerPopupCallback = (cb) => {
  popupCallback = cb
}

export const showConfirm = (message, title = 'Подтверждение') => {
  return new Promise((resolve) => {
    if (popupCallback) {
      popupCallback({ type: 'confirm', title, message, resolve })
    } else {
      resolve(window.confirm(message))
    }
  })
}

export const showAlert = (message, title = 'Внимание') => {
  return new Promise((resolve) => {
    if (popupCallback) {
      popupCallback({ type: 'alert', title, message, resolve })
    } else {
      window.alert(message)
      resolve()
    }
  })
}
