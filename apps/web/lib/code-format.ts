export type TemplateMode = "core" | "acm";
export type TemplateLanguage = "cpp" | "python";

export const DEFAULT_ACM_CODES: Record<TemplateLanguage, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // TODO: 按 ACM 输入规范读取 stdin
    // TODO: 输出答案到 stdout

    return 0;
}`,
  python: `import sys


def main() -> None:
    # TODO: 按 ACM 输入规范读取 stdin
    # TODO: 输出答案到 stdout
    pass


if __name__ == "__main__":
    main()
`
};

export function getDefaultTemplate(
  mode: TemplateMode,
  language: TemplateLanguage,
  initialCoreCodes: Record<TemplateLanguage, string>
): string {
  if (mode === "core") {
    return initialCoreCodes[language] ?? "";
  }

  return DEFAULT_ACM_CODES[language];
}
