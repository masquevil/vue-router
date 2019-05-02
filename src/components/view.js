import { warn } from '../util/warn'
import { extend } from '../util/misc'
import { getViewScrollTarget, getScroll } from '../util/scroll'

export default {
  name: 'RouterView',
  props: {
    name: {
      type: String,
      default: 'default'
    },
    max: {
      type: Number,
      default: 0
    }
  },
  created () {
    extend(this, {
      cache: Object.create(null),
      keys: [],
      currentKey: ''
    })
  },
  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },
  render (_) {
    const children = this.$slots.default
    const data = {}
    // used by devtools to display a router-view badge
    data.routerView = true

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    let parent = this.$parent
    const h = this.$createElement
    const name = this.name
    const route = this.$route
    const rvCache = this._routerViewCache || (this._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    let depth = 0
    let inactive = false
    while (parent && parent._routerRoot !== parent) {
      const vnodeData = parent.$vnode && parent.$vnode.data
      if (vnodeData) {
        if (vnodeData.routerView) {
          depth++
        }
        if (vnodeData.keepAlive && parent._inactive) {
          inactive = true
        }
      }
      parent = parent.$parent
    }
    data.routerViewDepth = depth

    // render previous view if the tree is inactive and kept-alive
    if (inactive) {
      const vnode = h(rvCache[name], data, children)
      vnode.key = this.currentKey
      return vnode
    }

    const matched = route.matched[depth]
    // render empty node if no matched route
    if (!matched) {
      rvCache[name] = null
      return h()
    }

    const component = rvCache[name] = matched.components[name]

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    data.registerRouteInstance = (vm, val) => {
      // val could be undefined for unregistration
      const current = matched.instances[name]
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val
      }
    };

    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    (data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

    // register instance in init hook
    // in case kept-alive component be actived when routes changed
    data.hook.init = (vnode) => {
      if (vnode.data.keepAlive &&
        vnode.componentInstance &&
        vnode.componentInstance !== matched.instances[name]
      ) {
        matched.instances[name] = vnode.componentInstance
      }
    }

    // resolve props
    let propsToPass = data.props = extend(resolveProps(route, matched.props && matched.props[name]), this.$attrs)
    if (propsToPass) {
      // clone to prevent mutation
      propsToPass = data.props = extend({}, propsToPass)
      // pass non-declared props as attrs
      const attrs = data.attrs = data.attrs || {}
      for (const key in propsToPass) {
        if (!component.props || !(key in component.props)) {
          attrs[key] = propsToPass[key]
          delete propsToPass[key]
        }
      }
    }

    const vnode = h(component, data, children)
    const componentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      const { cache, keys } = this
      // 这一步是关键，vue 根据 vnode.key 识别不同的 vnode
      let key = vnode.key
      if (!key || key.split('::')[0] !== 'arv') {
        key = [
          'arv',
          (window.history.state || {}).key || 'null',
          componentOptions.Ctor.cid,
          'props|' + (Object.entries(propsToPass || {}).map(item => item.join('=')).join('&') || 'null')
        ].join('::')
        vnode.key = key
      }
      if (cache[key]) {
        const cached = cache[key]
        vnode.componentInstance = cached.vnode.componentInstance
        remove(keys, key)
        keys.push(key)
        this.setScroll(cached)
      } else {
        const cached = cache[key] = {
          scroll: false,
          vnode: vnode
        }
        this.$nextTick(() => {
          cached.scrollTarget = getViewScrollTarget(this.$el)
        })
        keys.push(key)
        // prune oldest entry
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }
      this.currentKey = key
      vnode.data.keepAlive = true
    }
    return vnode
  },
  methods: {
    saveScroll () {
      const current = this.cache[this.currentKey]
      if (current.scrollTarget)current.scroll = getScroll(current.scrollTarget)
    },
    setScroll (cached) {
      this.$nextTick(() => {
        if (cached.scrollTarget && cached.scroll) {
          cached.scrollTarget.scrollTo(cached.scroll)
          cached.scroll = false
        }
      })
    }
  }
}

function remove (arr, item) {
  if (arr.length) {
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

function pruneCacheEntry (cache, key, keys, current) {
  const cached = cache[key]
  if (cached && (!current || cached.vnode.tag !== current.tag)) {
    cached.vnode.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
    default:
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        )
      }
  }
}
