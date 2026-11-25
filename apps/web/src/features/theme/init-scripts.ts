/*
 * Inline scripts for <head>. This module must NOT be a client module: the server layout reads these
 * strings, and values exported from a 'use client' file reach the server only as client references.
 */

export const THEME_STORAGE_KEY = 'kaligula.theme'

/** Runs inline in <head> before paint to avoid a flash of the wrong theme. Keep it dependency-free. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||((!p||p==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`

/** Marks the first load of a browser session so the console "power on" animation plays only once. */
export const BOOT_INIT_SCRIPT = `(function(){try{if(!sessionStorage.getItem('kaligula.booted')){sessionStorage.setItem('kaligula.booted','1');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.boot='1'}}catch(e){}})()`
