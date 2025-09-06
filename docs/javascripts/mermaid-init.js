document$.subscribe(() => {
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    mermaid.init(undefined, document.querySelectorAll(".language-mermaid, .mermaid"));
  }
});
