// The "codemirror" meta-package only re-exports EditorView/basicSetup/minimalSetup,
// so keymap/indentWithTab still need @codemirror/view and @codemirror/commands
// directly. To avoid pulling in a *second*, incompatible copy of @codemirror/view
// (extensions from one copy aren't recognized by an EditorView from another copy),
// these use the exact same unpinned "@codemirror/view@^6.0.0?target=es2022" /
// "@codemirror/commands@^6.0.0?target=es2022" specifiers that codemirror@6.0.1's
// own bundle imports internally, so esm.sh resolves both to the identical
// already-cached concrete file instead of a separately pinned version.
import { EditorView, basicSetup } from "https://esm.sh/codemirror@6.0.1?target=es2022";
import { python } from "https://esm.sh/@codemirror/lang-python@6.1.6?target=es2022";
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark@6.1.2?target=es2022";
import { keymap } from "https://esm.sh/@codemirror/view@^6.0.0?target=es2022";
import { indentWithTab } from "https://esm.sh/@codemirror/commands@^6.0.0?target=es2022";

export function createCodeEditor(parentEl, initialCode, onChange) {
  const view = new EditorView({
    doc: initialCode,
    extensions: [
      basicSetup,
      python(),
      oneDark,
      keymap.of([indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) onChange(view.state.doc.toString());
      }),
    ],
    parent: parentEl,
  });

  return {
    getCode: () => view.state.doc.toString(),
    setCode: (code) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
      });
    },
    view,
  };
}

export function setupStdinTextarea(textareaEl) {
  textareaEl.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = textareaEl.selectionStart;
      const end = textareaEl.selectionEnd;
      const value = textareaEl.value;
      textareaEl.value = value.slice(0, start) + "\t" + value.slice(end);
      textareaEl.selectionStart = textareaEl.selectionEnd = start + 1;
    }
  });
}
