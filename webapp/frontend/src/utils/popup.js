export const showConfirm = (message) => {
  return new Promise((resolve) => {
    const webApp = window.Telegram?.WebApp
    if (webApp && webApp.showConfirm) {
      webApp.showConfirm(message, (isOk) => resolve(isOk))
    } else {
      resolve(window.confirm(message))
    }
  })
}

export const showAlert = (message) => {
  return new Promise((resolve) => {
    const webApp = window.Telegram?.WebApp
    if (webApp && webApp.showAlert) {
      webApp.showAlert(message, () => resolve())
    } else {
      window.alert(message)
      resolve()
    }
  })
}
