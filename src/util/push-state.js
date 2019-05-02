/* @flow */

import { inBrowser } from './dom'
// import { saveScrollPosition } from './scroll'

export const supportsPushState = inBrowser && (function () {
  const ua = window.navigator.userAgent

  if (
    (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
    ua.indexOf('Mobile Safari') !== -1 &&
    ua.indexOf('Chrome') === -1 &&
    ua.indexOf('Windows Phone') === -1
  ) {
    return false
  }

  return window.history && 'pushState' in window.history
})()

// use User Timing api (if present) for more accurate key precision
const Time = Date

let _key: string
{
  const { controller } = window.history.state || {}
  _key = controller === 'vue-state-router' ? window.history.state.key : genKey()
}

function genKey (): string {
  return Time.now().toFixed(3)
}

function state () {
  return { controller: 'vue-state-router', key: _key }
}

export function getStateKey () {
  return _key
}

export function setStateKey (key: string) {
  _key = key
}

export function pushState (url?: string, replace?: boolean) {
  // saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history
  try {
    if (replace) {
      history.replaceState(Object.assign(state(), history.state), null, url)
    } else {
      _key = genKey()
      history.pushState(state(), null, url)
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

export function replaceState (url?: string) {
  pushState(url, true)
}
