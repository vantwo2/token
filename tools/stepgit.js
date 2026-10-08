#!/usr/bin/env node
// stepgit: a small git-like step recorder. No dependencies.
// Each "snap" stores the content of every project file (by sha256) and appends one entry to .stepgit/log.jsonl.
//
// Usage (run from the project root, or set STEPGIT_ROOT):
//   node tools/stepgit.js init
//   node tools/stepgit.js snap "message describing the step"
//   node tools/stepgit.js status            files changed since the last snap
//   node tools/stepgit.js log               list entries, newest first
//   node tools/stepgit.js diff [id]         changes since entry id (default: last)
//   node tools/stepgit.js show <id> <path>  print one file as it was at entry id
//   node tools/stepgit.js restore <id> --yes  write files back as they were at entry id

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(process.env.STEPGIT_ROOT || process.cwd())
const DIR = path.join(ROOT, '.stepgit')
const OBJECTS = path.join(DIR, 'objects')
const LOG = path.join(DIR, 'log.jsonl')
const IGNORE = new Set(['.stepgit', 'node_modules', '.git'])

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex')

// Walk the project and return { 'relative/path': buffer }.
function scan(dir = ROOT, out = {}) {
  for (const name of fs.readdirSync(dir)) {
    if (IGNORE.has(name)) continue
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) scan(full, out)
    else out[path.relative(ROOT, full).split(path.sep).join('/')] = fs.readFileSync(full)
  }
  return out
}

function entries() {
  if (!fs.existsSync(LOG)) return []
  return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
}

// Entry ids are 1-based sequence numbers, written as "#n".
function findEntry(id) {
  const all = entries()
  if (all.length === 0) throw new Error('no snaps yet; run snap first')
  const n = id === undefined ? all.length : Number(String(id).replace('#', ''))
  const entry = all[n - 1]
  if (!entry) throw new Error(`no entry ${id}`)
  return entry
}

function requireInit() {
  if (!fs.existsSync(DIR)) throw new Error('not initialised; run init first')
}

// Compare the current tree with a snapshot's file map.
function changes(files, snapFiles) {
  const added = Object.keys(files).filter(p => !(p in snapFiles))
  const removed = Object.keys(snapFiles).filter(p => !(p in files))
  const modified = Object.keys(files).filter(p => p in snapFiles && sha(files[p]) !== snapFiles[p])
  return { added, removed, modified }
}

function snapFilesOf(entry) {
  return entry.files
}

const commands = {
  init() {
    fs.mkdirSync(OBJECTS, { recursive: true })
    if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, '')
    console.log(`initialised ${DIR}`)
  },

  snap(message) {
    requireInit()
    if (!message) throw new Error('snap needs a message')
    const files = scan()
    const map = {}
    for (const [p, buf] of Object.entries(files)) {
      const hash = sha(buf)
      map[p] = hash
      const obj = path.join(OBJECTS, hash)
      if (!fs.existsSync(obj)) fs.writeFileSync(obj, buf)
    }
    const all = entries()
    const entry = { id: all.length + 1, time: new Date().toISOString(), message, files: map }
    fs.appendFileSync(LOG, JSON.stringify(entry) + '\n')
    console.log(`#${entry.id} ${message} (${Object.keys(map).length} files)`)
  },

  status() {
    requireInit()
    const last = entries().slice(-1)[0]
    const c = changes(scan(), last ? snapFilesOf(last) : {})
    console.log(`since #${last ? last.id : 0}:`)
    for (const [k, list] of Object.entries(c)) for (const p of list) console.log(`  ${k}: ${p}`)
    if (!c.added.length && !c.removed.length && !c.modified.length) console.log('  clean')
  },

  log() {
    requireInit()
    const all = entries().slice().reverse()
    if (all.length === 0) console.log('no entries')
    for (const e of all) console.log(`#${e.id}  ${e.time}  ${e.message}  (${Object.keys(e.files).length} files)`)
  },

  diff(id) {
    requireInit()
    const entry = findEntry(id)
    const c = changes(scan(), snapFilesOf(entry))
    console.log(`changes since #${entry.id}:`)
    for (const [k, list] of Object.entries(c)) for (const p of list) console.log(`  ${k}: ${p}`)
    if (!c.added.length && !c.removed.length && !c.modified.length) console.log('  none')
  },

  show(id, file) {
    requireInit()
    const entry = findEntry(id)
    const hash = entry.files[file]
    if (!hash) throw new Error(`${file} is not in #${entry.id}`)
    process.stdout.write(fs.readFileSync(path.join(OBJECTS, hash)))
  },

  restore(id, flag) {
    requireInit()
    if (flag !== '--yes') throw new Error('restore overwrites files; re-run with --yes to confirm')
    const entry = findEntry(id)
    for (const [p, hash] of Object.entries(entry.files)) {
      const full = path.join(ROOT, p)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, fs.readFileSync(path.join(OBJECTS, hash)))
    }
    console.log(`restored ${Object.keys(entry.files).length} files from #${entry.id} (files added after it are kept)`)
  },
}

const [cmd, ...args] = process.argv.slice(2)
if (!commands[cmd]) {
  console.log('usage: stepgit.js init | snap "msg" | status | log | diff [id] | show <id> <path> | restore <id> --yes')
  process.exit(cmd ? 1 : 0)
}
try {
  commands[cmd](...args)
} catch (err) {
  console.error(`stepgit: ${err.message}`)
  process.exit(1)
}
