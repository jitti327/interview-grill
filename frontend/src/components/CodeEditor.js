import Editor from "@monaco-editor/react";

export default function CodeEditor({ value, onChange, language = "javascript", height = "250px" }) {
  return (
    <div className="border border-[#27272A] overflow-hidden" data-testid="code-editor-wrapper">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1E1E1E] border-b border-[#27272A]">
        <div className="w-2 h-2 bg-red-500" />
        <div className="w-2 h-2 bg-yellow-500" />
        <div className="w-2 h-2 bg-green-500" />
        <span className="text-[10px] text-zinc-600 ml-1">{language}</span>
      </div>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={onChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          scrollBeyondLastLine: false,
          padding: { top: 8 },
          lineNumbers: "on",
          renderLineHighlight: "gutter",
          tabSize: 2,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
