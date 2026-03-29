function buildCppTwoSumProgram(userCode) {
  return `#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

${userCode}

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  int n = 0;
  if (!(cin >> n) || n < 0) {
    cout << "invalid";
    return 0;
  }

  vector<int> nums(n);
  for (int i = 0; i < n; ++i) {
    if (!(cin >> nums[i])) {
      cout << "invalid";
      return 0;
    }
  }

  int target = 0;
  if (!(cin >> target)) {
    cout << "invalid";
    return 0;
  }

  auto result = twoSum(nums, target);
  if (result.size() < 2) {
    cout << "invalid";
    return 0;
  }

  vector<int> pairValues = {result[0], result[1]};
  sort(pairValues.begin(), pairValues.end());
  cout << "[" << pairValues[0] << "," << pairValues[1] << "]";
  return 0;
}
`;
}

function buildCppValidParenthesesProgram(userCode) {
  return `#include <iostream>
#include <string>
using namespace std;

${userCode}

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  string s;
  if (!getline(cin, s)) {
    cout << "invalid";
    return 0;
  }

  const bool result = isValid(s);
  cout << (result ? "true" : "false");
  return 0;
}
`;
}

function buildCppContainerProgram(userCode) {
  return `#include <iostream>
#include <vector>
using namespace std;

${userCode}

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  int n = 0;
  if (!(cin >> n) || n < 0) {
    cout << "invalid";
    return 0;
  }

  vector<int> height(n);
  for (int i = 0; i < n; ++i) {
    if (!(cin >> height[i])) {
      cout << "invalid";
      return 0;
    }
  }

  cout << maxArea(height);
  return 0;
}
`;
}

function buildPythonResolveEntry(entryFunctionName) {
  return `def _resolve_entry():
    direct = globals().get("${entryFunctionName}")
    if callable(direct):
        return direct

    solution_cls = globals().get("Solution")
    if solution_cls is not None:
        instance = solution_cls()
        method = getattr(instance, "${entryFunctionName}", None)
        if callable(method):
            return method

    raise RuntimeError("Entry function not found: ${entryFunctionName}")
`;
}

function buildPythonTwoSumProgram(userCode) {
  return `${userCode}

${buildPythonResolveEntry("twoSum")}

def main():
    import sys

    parts = sys.stdin.read().strip().split()
    if not parts:
        print("invalid", end="")
        return

    n = int(parts[0])
    expected_length = 1 + n + 1
    if len(parts) < expected_length:
        print("invalid", end="")
        return

    nums = [int(value) for value in parts[1 : 1 + n]]
    target = int(parts[1 + n])

    entry = _resolve_entry()
    result = entry(nums, target)

    if not isinstance(result, (list, tuple)) or len(result) < 2:
        print("invalid", end="")
        return

    pair_values = sorted([int(result[0]), int(result[1])])
    print(f"[{pair_values[0]},{pair_values[1]}]", end="")


if __name__ == "__main__":
    main()
`;
}

function buildPythonValidParenthesesProgram(userCode) {
  return `${userCode}

${buildPythonResolveEntry("isValid")}

def main():
    import sys

    s = sys.stdin.read().splitlines()
    if not s:
        print("invalid", end="")
        return

    entry = _resolve_entry()
    result = entry(s[0])

    if isinstance(result, bool):
        print("true" if result else "false", end="")
        return

    if isinstance(result, (int, float)):
        print("true" if int(result) != 0 else "false", end="")
        return

    print("invalid", end="")


if __name__ == "__main__":
    main()
`;
}

function buildPythonContainerProgram(userCode) {
  return `${userCode}

${buildPythonResolveEntry("maxArea")}

def main():
    import sys

    parts = sys.stdin.read().strip().split()
    if not parts:
        print("invalid", end="")
        return

    n = int(parts[0])
    if len(parts) < 1 + n:
        print("invalid", end="")
        return

    height = [int(value) for value in parts[1 : 1 + n]]

    entry = _resolve_entry()
    result = entry(height)

    if isinstance(result, bool):
        print("invalid", end="")
        return

    print(int(result), end="")


if __name__ == "__main__":
    main()
`;
}

export function buildCppCoreProgram(problemSlug, userCode) {
  if (problemSlug === "two-sum") {
    return buildCppTwoSumProgram(userCode);
  }

  if (problemSlug === "valid-parentheses") {
    return buildCppValidParenthesesProgram(userCode);
  }

  if (problemSlug === "container-with-most-water") {
    return buildCppContainerProgram(userCode);
  }

  throw new Error(`Unsupported core C++ problem slug: ${problemSlug}`);
}

export function buildPythonCoreProgram(problemSlug, userCode) {
  if (problemSlug === "two-sum") {
    return buildPythonTwoSumProgram(userCode);
  }

  if (problemSlug === "valid-parentheses") {
    return buildPythonValidParenthesesProgram(userCode);
  }

  if (problemSlug === "container-with-most-water") {
    return buildPythonContainerProgram(userCode);
  }

  throw new Error(`Unsupported core Python problem slug: ${problemSlug}`);
}
