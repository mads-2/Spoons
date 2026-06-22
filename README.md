# spoons

personal energy tracker, spoon theory, just for me.

---

## updating the app

1. iterate with Claude, download the new `spoon-tracker.jsx` (lands in `~/Downloads`)
2. run: `./sync.sh "what changed"`

that's it. copies the file in, rebuilds, commits, pushes.

---

## adding the app to your phone

1. open Safari on your iPhone (must be Safari, not Chrome)
2. go to `https://mads-2.github.io/Spoons/`
3. tap the Share button (box with arrow)
4. tap **Add to Home Screen**
5. tap **Add**

that's it — it'll appear as an app icon and run fullscreen.

---

## updating the app on your phone

after sync runs, kill the app (swipe up) and reopen. one or two relaunches picks up the new build.

if it's stuck on an old version: delete the app icon and re-add to home screen from Safari.

---

## your data

lives in `localStorage` on your phone — tied to the URL, not the icon. survives app closes and updates. **never gets pushed to GitHub.**

to back it up: use the export button in the app. keep exports out of the repo folder or `.gitignore` will catch them anyway.

---

## rolling back

```bash
git log --oneline                          # find the commit
git checkout <sha> -- src/App.jsx          # restore that version
./sync.sh "rollback to x"
```

---

## running locally (optional)

```bash
npm install
npm run dev
```
