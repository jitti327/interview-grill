"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getQuestions, updateQuestionCodingAssets } from "@/lib/api";

function parseCases(text) {
  if (!text.trim()) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((x, idx) => ({
      label: String(x?.label || `Case ${idx + 1}`),
      input: String(x?.input || ""),
      expected_output: String(x?.expected_output || ""),
    }));
  } catch {
    return null;
  }
}

export default function AdminQuestionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stack, setStack] = useState("nodejs");
  const [difficulty, setDifficulty] = useState("medium");
  const [questions, setQuestions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [template, setTemplate] = useState("");
  const [testCasesText, setTestCasesText] = useState("[]");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "admin") {
      toast.error("Admin access required.");
      router.replace("/dashboard");
    }
  }, [authLoading, router, user]);

  const selected = useMemo(
    () => questions.find((q) => q.id === selectedId) || null,
    [questions, selectedId],
  );

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await getQuestions(stack, 100, difficulty);
      const coding = (res.data || []).filter((q) => q.question_type === "coding");
      setQuestions(coding);
      if (coding.length > 0) {
        const first = coding[0];
        setSelectedId(first.id);
        setTemplate(first.coding_template || "");
        setTestCasesText(JSON.stringify(first.coding_test_cases || [], null, 2));
      } else {
        setSelectedId("");
        setTemplate("");
        setTestCasesText("[]");
      }
    } catch {
      toast.error("Failed to load coding questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, difficulty, user?.role]);

  useEffect(() => {
    if (!selected) return;
    setTemplate(selected.coding_template || "");
    setTestCasesText(JSON.stringify(selected.coding_test_cases || [], null, 2));
  }, [selected]);

  const handleSave = async () => {
    if (!selectedId) return;
    const cases = parseCases(testCasesText);
    if (cases == null) {
      toast.error("Test cases must be valid JSON array.");
      return;
    }
    setSaving(true);
    try {
      await updateQuestionCodingAssets(selectedId, template, cases);
      setQuestions((prev) =>
        prev.map((q) => (q.id === selectedId ? { ...q, coding_template: template, coding_test_cases: cases } : q)),
      );
      toast.success("Coding assets updated.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save coding assets.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        <h1 className="font-heading text-2xl font-bold text-white mb-2">Admin Coding Question Assets</h1>
        <p className="text-xs text-zinc-500 mb-6">Edit coding template and test cases saved in database.</p>

        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={stack}
            onChange={(e) => setStack(e.target.value)}
            className="bg-[#121212] border border-[#27272A] text-sm text-white px-3 py-2"
          >
            {["nodejs", "react", "angular", "vue", "ember", "nextjs", "express", "python", "java", "dotnet"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="bg-[#121212] border border-[#27272A] text-sm text-white px-3 py-2"
          >
            {["easy", "medium", "hard"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button
            onClick={loadQuestions}
            disabled={loading}
            className="border border-[#27272A] text-zinc-300 text-xs font-bold px-3 py-2 hover:border-yellow-500 hover:text-yellow-500"
          >
            {loading ? "LOADING..." : "REFRESH"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-[#121212] border border-[#27272A] p-3 max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="flex items-center gap-2 text-zinc-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : questions.length === 0 ? (
              <div className="text-zinc-500 text-sm">No coding questions found.</div>
            ) : (
              questions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedId(q.id)}
                  className={`w-full text-left p-2 mb-2 border ${
                    selectedId === q.id
                      ? "border-yellow-500 bg-yellow-500/10"
                      : "border-[#27272A] hover:border-zinc-600"
                  }`}
                >
                  <div className="text-[10px] text-zinc-500 mb-1">{q.id}</div>
                  <div className="text-xs text-zinc-200 line-clamp-3">{q.question}</div>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-2 bg-[#121212] border border-[#27272A] p-4">
            {!selected ? (
              <div className="text-zinc-500 text-sm">Select a coding question to edit.</div>
            ) : (
              <>
                <div className="text-[10px] text-zinc-500 mb-1">{selected.id}</div>
                <div className="text-sm text-zinc-200 mb-4">{selected.question}</div>

                <label className="text-xs text-zinc-400 block mb-1">Coding Template</label>
                <textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  rows={14}
                  className="w-full bg-[#0A0A0A] border border-[#27272A] text-xs text-white p-3 font-mono mb-4"
                />

                <label className="text-xs text-zinc-400 block mb-1">Test Cases JSON</label>
                <textarea
                  value={testCasesText}
                  onChange={(e) => setTestCasesText(e.target.value)}
                  rows={10}
                  className="w-full bg-[#0A0A0A] border border-[#27272A] text-xs text-white p-3 font-mono"
                />
                <p className="text-[10px] text-zinc-600 mt-1">
                  Format: [{"{"}"label":"Case 1","input":"1 2","expected_output":"3"{"}"}]
                </p>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="mt-4 bg-yellow-500 text-black font-bold text-xs px-4 py-2 hover:bg-yellow-400 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  SAVE CODING ASSETS
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
