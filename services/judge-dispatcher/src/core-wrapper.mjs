import { readFileSync } from "node:fs";

const CORE_METADATA = JSON.parse(readFileSync(new URL("./core-metadata.json", import.meta.url), "utf8"));

function normalizeCppType(type) {
  return String(type)
    .replace(/\s+/g, " ")
    .replace(/\s*\*\s*/g, "*")
    .replace(/\s*&\s*/g, "&")
    .trim();
}

function storageCppType(type) {
  return normalizeCppType(type).replace(/^const\s+/, "").replace(/&$/, "").trim();
}

function getProblemMeta(problemSlug) {
  const meta = CORE_METADATA[problemSlug];
  if (!meta) {
    throw new Error(`Unsupported core problem slug: ${problemSlug}`);
  }

  return meta;
}

function getSolutionMethod(meta) {
  const method = meta.methods.find((item) => item.returnType !== null);
  if (!method) {
    throw new Error(`Invalid solution metadata for class ${meta.className}`);
  }

  return method;
}

function buildCppSolutionMain(problemSlug, meta) {
  const method = getSolutionMethod(meta);
  const paramDecls = [];

  if (problemSlug === "intersection-of-two-linked-lists") {
    paramDecls.push("    auto __intersection = __build_intersection_lists(__kv);");
  }

  for (const param of method.params) {
    const type = storageCppType(param.type);
    const name = param.name;

    if (problemSlug === "intersection-of-two-linked-lists" && name === "headA") {
      paramDecls.push("    ListNode* __headA = __intersection.first;");
      continue;
    }

    if (problemSlug === "intersection-of-two-linked-lists" && name === "headB") {
      paramDecls.push("    ListNode* __headB = __intersection.second;");
      continue;
    }

    if ((problemSlug === "linked-list-cycle" || problemSlug === "linked-list-cycle-ii") && name === "head") {
      paramDecls.push(
        "    ListNode* __head = __build_list_from_json(__resolve_param(__kv, \"head\"), true, __json_to_int(__resolve_param(__kv, \"pos\")));"
      );
      continue;
    }

    if (problemSlug === "lowest-common-ancestor-of-a-binary-tree" && (name === "p" || name === "q")) {
      paramDecls.push(
        `    TreeNode* __${name} = __find_tree_node_by_val(__root, __json_to_int(__resolve_param(__kv, \"${name}\")));`
      );
      continue;
    }

    paramDecls.push(
      `    ${type} __${name} = __convert_param<${type}>(__resolve_param(__kv, \"${name}\"));`
    );
  }

  const args = method.params.map((param) => `__${param.name}`).join(", ");
  const lines = [
    "int main() {",
    "  try {",
    "    std::ios::sync_with_stdio(false);",
    "    std::cin.tie(nullptr);",
    "",
    "    const std::string __input = __read_stdin_all();",
    "    const auto __kv = __parse_key_value_input(__input);",
    ...paramDecls,
    "",
    `    ${meta.className} __instance;`
  ];

  if (method.returnType === "void") {
    if (method.params.length > 0) {
      lines.push(`    __instance.${method.name}(${args});`);
      lines.push(`    __print_json(__to_json_value(__${method.params[0].name}));`);
      lines.push("    return 0;");
    } else {
      lines.push(`    __instance.${method.name}(${args});`);
      lines.push("    __print_json(nullptr);");
      lines.push("    return 0;");
    }
  } else {
    const returnType = storageCppType(method.returnType);
    lines.push(`    ${returnType} __result = __instance.${method.name}(${args});`);

    if (problemSlug === "linked-list-cycle-ii") {
      lines.push("    if (__result == nullptr) {");
      lines.push("      __print_json(nullptr);");
      lines.push("    } else {");
      lines.push("      __print_json(__result->val);");
      lines.push("    }");
      lines.push("    return 0;");
    } else if (problemSlug === "lowest-common-ancestor-of-a-binary-tree") {
      lines.push("    if (__result == nullptr) {");
      lines.push("      __print_json(nullptr);");
      lines.push("    } else {");
      lines.push("      __print_json(__result->val);");
      lines.push("    }");
      lines.push("    return 0;");
    } else {
      lines.push("    __print_json(__to_json_value(__result));");
      lines.push("    return 0;");
    }
  }

  lines.push("  } catch (const std::exception&) {");
  lines.push("    std::cout << \"invalid\";");
  lines.push("    return 0;");
  lines.push("  }");
  lines.push("}");

  return lines.join("\n");
}

function buildCppDesignMain(meta) {
  const constructor = meta.methods.find((item) => item.returnType === null && item.name === meta.className) ?? {
    params: []
  };
  const methods = meta.methods.filter((item) => item.returnType !== null);

  const lines = [
    "int main() {",
    "  try {",
    "    std::ios::sync_with_stdio(false);",
    "    std::cin.tie(nullptr);",
    "",
    "    const std::string __input = __read_stdin_all();",
    "    auto __design = __parse_design_input(__input);",
    "    const json __ops = __design.first;",
    "    const json __argsets = __design.second;",
    "",
    "    json __outputs = json::array();",
    `    std::unique_ptr<${meta.className}> __obj;`,
    "",
    "    for (size_t __i = 0; __i < __ops.size(); ++__i) {",
    "      const std::string __op = __ops[__i].is_string() ? __ops[__i].get<std::string>() : std::string();",
    "      const json __arglist = (__i < __argsets.size() && __argsets[__i].is_array()) ? __argsets[__i] : json::array();",
    ""
  ];

  const ctorArgs = constructor.params
    .map((param, idx) => {
      const type = storageCppType(param.type);
      return `__convert_param<${type}>(__arg_at(__arglist, ${idx}))`;
    })
    .join(", ");

  lines.push(`      if (__op == \"${meta.className}\") {`);
  lines.push(`        __obj = std::make_unique<${meta.className}>(${ctorArgs});`);
  lines.push("        __outputs.push_back(nullptr);");
  lines.push("        continue;");
  lines.push("      }");
  lines.push("");
  lines.push("      if (!__obj) {");
  lines.push("        __outputs.push_back(nullptr);");
  lines.push("        continue;");
  lines.push("      }");
  lines.push("");

  for (const method of methods) {
    const argDecls = method.params.map((param, idx) => {
      const type = storageCppType(param.type);
      return `        ${type} __arg${idx} = __convert_param<${type}>(__arg_at(__arglist, ${idx}));`;
    });
    const argNames = method.params.map((_, idx) => `__arg${idx}`).join(", ");

    lines.push(`      if (__op == \"${method.name}\") {`);
    lines.push(...argDecls);

    if (method.returnType === "void") {
      lines.push(`        __obj->${method.name}(${argNames});`);
      lines.push("        __outputs.push_back(nullptr);");
    } else {
      lines.push(`        auto __ret = __obj->${method.name}(${argNames});`);
      lines.push("        __outputs.push_back(__to_json_value(__ret));");
    }

    lines.push("        continue;");
    lines.push("      }");
    lines.push("");
  }

  lines.push("      __outputs.push_back(nullptr);");
  lines.push("    }");
  lines.push("");
  lines.push("    __print_json(__outputs);");
  lines.push("    return 0;");
  lines.push("  } catch (const std::exception&) {");
  lines.push("    std::cout << \"invalid\";");
  lines.push("    return 0;");
  lines.push("  }");
  lines.push("}");

  return lines.join("\n");
}

const CPP_CORE_RUNTIME = `#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <queue>
#include <sstream>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

#include "json.hpp"

using json = nlohmann::json;
using namespace std;

struct ListNode {
  int val;
  ListNode* next;
  ListNode() : val(0), next(nullptr) {}
  ListNode(int x) : val(x), next(nullptr) {}
  ListNode(int x, ListNode* next_node) : val(x), next(next_node) {}
};

struct TreeNode {
  int val;
  TreeNode* left;
  TreeNode* right;
  TreeNode() : val(0), left(nullptr), right(nullptr) {}
  TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
  TreeNode(int x, TreeNode* left_node, TreeNode* right_node) : val(x), left(left_node), right(right_node) {}
};

class Node {
 public:
  int val;
  Node* next;
  Node* random;

  Node() : val(0), next(nullptr), random(nullptr) {}
  explicit Node(int v) : val(v), next(nullptr), random(nullptr) {}
  Node(int v, Node* next_node, Node* random_node) : val(v), next(next_node), random(random_node) {}
};

std::string __trim(const std::string& text) {
  size_t left = 0;
  size_t right = text.size();

  while (left < right && std::isspace(static_cast<unsigned char>(text[left])) != 0) {
    left += 1;
  }
  while (right > left && std::isspace(static_cast<unsigned char>(text[right - 1])) != 0) {
    right -= 1;
  }

  return text.substr(left, right - left);
}

std::string __read_stdin_all() {
  std::ostringstream buffer;
  buffer << std::cin.rdbuf();
  return __trim(buffer.str());
}

std::vector<std::string> __split_top_level(const std::string& text, char delimiter) {
  std::vector<std::string> parts;
  std::string current;
  int depth_square = 0;
  int depth_curly = 0;
  int depth_round = 0;
  int depth_angle = 0;
  bool in_string = false;
  char quote_char = '\\0';

  for (size_t i = 0; i < text.size(); i += 1) {
    const char ch = text[i];

    if (in_string) {
      current.push_back(ch);
      if (ch == quote_char && (i == 0 || text[i - 1] != '\\\\')) {
        in_string = false;
      }
      continue;
    }

    if (ch == 39 || ch == 34) {
      in_string = true;
      quote_char = ch;
      current.push_back(ch);
      continue;
    }

    if (ch == '[') depth_square += 1;
    if (ch == ']') depth_square -= 1;
    if (ch == '{') depth_curly += 1;
    if (ch == '}') depth_curly -= 1;
    if (ch == '(') depth_round += 1;
    if (ch == ')') depth_round -= 1;
    if (ch == '<') depth_angle += 1;
    if (ch == '>') depth_angle -= 1;

    if (ch == delimiter && depth_square == 0 && depth_curly == 0 && depth_round == 0 && depth_angle == 0) {
      parts.push_back(__trim(current));
      current.clear();
      continue;
    }

    current.push_back(ch);
  }

  if (!__trim(current).empty()) {
    parts.push_back(__trim(current));
  }

  return parts;
}

json __parse_value(const std::string& raw) {
  const std::string trimmed = __trim(raw);
  if (trimmed.empty()) {
    return nullptr;
  }

  try {
    return json::parse(trimmed);
  } catch (...) {
    if (trimmed == "true") return true;
    if (trimmed == "false") return false;
    if (trimmed == "null") return nullptr;

    if (trimmed.size() >= 2 && trimmed.front() == 39 && trimmed.back() == 39) {
      return trimmed.substr(1, trimmed.size() - 2);
    }

    char* end_ptr = nullptr;
    const double value = std::strtod(trimmed.c_str(), &end_ptr);
    if (end_ptr != nullptr && *end_ptr == '\\0') {
      if (trimmed.find('.') == std::string::npos && trimmed.find('e') == std::string::npos && trimmed.find('E') == std::string::npos) {
        return static_cast<long long>(value);
      }
      return value;
    }

    return trimmed;
  }
}

std::unordered_map<std::string, json> __parse_key_value_input(const std::string& text) {
  std::unordered_map<std::string, json> values;

  for (const std::string& token : __split_top_level(text, ',')) {
    const size_t pos = token.find('=');
    if (pos == std::string::npos) {
      continue;
    }

    const std::string key = __trim(token.substr(0, pos));
    const std::string value = __trim(token.substr(pos + 1));
    if (key.empty()) {
      continue;
    }

    values[key] = __parse_value(value);
  }

  return values;
}

std::pair<json, json> __parse_design_input(const std::string& text) {
  if (text.empty()) {
    return {json::array(), json::array()};
  }

  const size_t first_open = text.find('[');
  if (first_open == std::string::npos) {
    return {json::array(), json::array()};
  }

  size_t first_close = std::string::npos;
  bool in_string = false;
  char quote_char = '\\0';
  int depth = 0;

  for (size_t i = first_open; i < text.size(); i += 1) {
    const char ch = text[i];

    if (in_string) {
      if (ch == quote_char && (i == 0 || text[i - 1] != '\\\\')) {
        in_string = false;
      }
      continue;
    }

    if (ch == 39 || ch == 34) {
      in_string = true;
      quote_char = ch;
      continue;
    }

    if (ch == '[') depth += 1;
    if (ch == ']') depth -= 1;
    if (depth == 0) {
      first_close = i;
      break;
    }
  }

  if (first_close == std::string::npos) {
    return {json::array(), json::array()};
  }

  const std::string ops_raw = text.substr(first_open, first_close - first_open + 1);
  const std::string rest = __trim(text.substr(first_close + 1));

  if (rest.empty()) {
    return {json::parse(ops_raw), json::array()};
  }

  const size_t second_open = rest.find('[');
  if (second_open == std::string::npos) {
    return {json::parse(ops_raw), json::array()};
  }

  return {json::parse(ops_raw), json::parse(rest.substr(second_open))};
}

int __json_to_int(const json& value) {
  if (value.is_number_integer()) {
    return value.get<int>();
  }
  if (value.is_number_float()) {
    return static_cast<int>(value.get<double>());
  }
  if (value.is_string()) {
    return std::stoi(value.get<std::string>());
  }
  return 0;
}

ListNode* __build_list_from_json(const json& value, bool make_cycle, int cycle_pos) {
  if (!value.is_array()) {
    return nullptr;
  }

  std::vector<ListNode*> nodes;
  nodes.reserve(value.size());

  for (const auto& item : value) {
    if (item.is_null()) {
      nodes.push_back(nullptr);
    } else {
      nodes.push_back(new ListNode(__json_to_int(item)));
    }
  }

  ListNode* head = nullptr;
  ListNode* prev = nullptr;
  std::vector<ListNode*> linear_nodes;

  for (ListNode* node : nodes) {
    if (node == nullptr) {
      continue;
    }

    if (head == nullptr) {
      head = node;
    }
    if (prev != nullptr) {
      prev->next = node;
    }
    prev = node;
    linear_nodes.push_back(node);
  }

  if (make_cycle && prev != nullptr && cycle_pos >= 0 && static_cast<size_t>(cycle_pos) < linear_nodes.size()) {
    prev->next = linear_nodes[static_cast<size_t>(cycle_pos)];
  }

  return head;
}

std::pair<ListNode*, ListNode*> __build_intersection_lists(const std::unordered_map<std::string, json>& kv) {
  const json list_a_json = kv.count("listA") != 0 ? kv.at("listA") : json::array();
  const json list_b_json = kv.count("listB") != 0 ? kv.at("listB") : json::array();

  ListNode* head_a = __build_list_from_json(list_a_json, false, -1);

  std::vector<ListNode*> nodes_a;
  for (ListNode* cursor = head_a; cursor != nullptr; cursor = cursor->next) {
    nodes_a.push_back(cursor);
  }

  const int skip_a = kv.count("skipA") != 0 ? __json_to_int(kv.at("skipA")) : -1;
  const int skip_b = kv.count("skipB") != 0 ? __json_to_int(kv.at("skipB")) : -1;

  ListNode* intersection = nullptr;
  if (skip_a >= 0 && static_cast<size_t>(skip_a) < nodes_a.size()) {
    intersection = nodes_a[static_cast<size_t>(skip_a)];
  }

  ListNode* head_b = nullptr;
  ListNode* tail_b = nullptr;

  if (list_b_json.is_array()) {
    for (size_t index = 0; index < list_b_json.size(); index += 1) {
      if (skip_b >= 0 && static_cast<int>(index) >= skip_b) {
        break;
      }

      const json& item = list_b_json[index];
      if (item.is_null()) {
        continue;
      }

      ListNode* node = new ListNode(__json_to_int(item));
      if (head_b == nullptr) {
        head_b = node;
      }
      if (tail_b != nullptr) {
        tail_b->next = node;
      }
      tail_b = node;
    }
  }

  if (head_b == nullptr) {
    head_b = intersection;
  } else if (tail_b != nullptr) {
    tail_b->next = intersection;
  }

  return {head_a, head_b};
}

TreeNode* __build_tree_from_level_order(const json& value) {
  if (!value.is_array() || value.empty() || value[0].is_null()) {
    return nullptr;
  }

  TreeNode* root = new TreeNode(__json_to_int(value[0]));
  std::queue<TreeNode*> queue;
  queue.push(root);
  size_t index = 1;

  while (!queue.empty() && index < value.size()) {
    TreeNode* current = queue.front();
    queue.pop();

    if (!value[index].is_null()) {
      current->left = new TreeNode(__json_to_int(value[index]));
      queue.push(current->left);
    }
    index += 1;

    if (index >= value.size()) {
      break;
    }

    if (!value[index].is_null()) {
      current->right = new TreeNode(__json_to_int(value[index]));
      queue.push(current->right);
    }
    index += 1;
  }

  return root;
}

TreeNode* __find_tree_node_by_val(TreeNode* root, int target) {
  if (root == nullptr) {
    return nullptr;
  }

  std::queue<TreeNode*> queue;
  queue.push(root);

  while (!queue.empty()) {
    TreeNode* current = queue.front();
    queue.pop();

    if (current->val == target) {
      return current;
    }

    if (current->left != nullptr) {
      queue.push(current->left);
    }
    if (current->right != nullptr) {
      queue.push(current->right);
    }
  }

  return nullptr;
}

Node* __build_random_list_from_json(const json& value) {
  if (!value.is_array()) {
    return nullptr;
  }

  std::vector<Node*> nodes;
  nodes.reserve(value.size());

  for (const auto& item : value) {
    if (!item.is_array() || item.empty() || item[0].is_null()) {
      nodes.push_back(new Node(0));
    } else {
      nodes.push_back(new Node(__json_to_int(item[0])));
    }
  }

  for (size_t i = 0; i + 1 < nodes.size(); i += 1) {
    nodes[i]->next = nodes[i + 1];
  }

  for (size_t i = 0; i < value.size(); i += 1) {
    const auto& item = value[i];
    if (!item.is_array() || item.size() < 2 || item[1].is_null()) {
      nodes[i]->random = nullptr;
      continue;
    }

    const int random_index = __json_to_int(item[1]);
    if (random_index >= 0 && static_cast<size_t>(random_index) < nodes.size()) {
      nodes[i]->random = nodes[static_cast<size_t>(random_index)];
    }
  }

  return nodes.empty() ? nullptr : nodes[0];
}

template <typename T>
struct __is_vector : std::false_type {};

template <typename T, typename Alloc>
struct __is_vector<std::vector<T, Alloc>> : std::true_type {};

template <typename T>
T __convert_param(const json& value) {
  using CleanT = std::remove_cv_t<std::remove_reference_t<T>>;

  if constexpr (std::is_same_v<CleanT, int>) {
    return __json_to_int(value);
  } else if constexpr (std::is_same_v<CleanT, long long>) {
    if (value.is_number_integer()) return value.get<long long>();
    if (value.is_number_float()) return static_cast<long long>(value.get<double>());
    if (value.is_string()) return std::stoll(value.get<std::string>());
    return 0LL;
  } else if constexpr (std::is_same_v<CleanT, double>) {
    if (value.is_number()) return value.get<double>();
    if (value.is_string()) return std::stod(value.get<std::string>());
    return 0.0;
  } else if constexpr (std::is_same_v<CleanT, bool>) {
    if (value.is_boolean()) return value.get<bool>();
    if (value.is_number_integer()) return value.get<int>() != 0;
    if (value.is_string()) {
      const std::string text = value.get<std::string>();
      return text == "true" || text == "1";
    }
    return false;
  } else if constexpr (std::is_same_v<CleanT, std::string>) {
    if (value.is_string()) return value.get<std::string>();
    return value.dump();
  } else if constexpr (__is_vector<CleanT>::value) {
    using Item = typename CleanT::value_type;
    CleanT result;
    if (!value.is_array()) {
      return result;
    }
    result.reserve(value.size());
    for (const auto& item : value) {
      result.push_back(__convert_param<Item>(item));
    }
    return result;
  } else if constexpr (std::is_same_v<CleanT, ListNode*>) {
    return __build_list_from_json(value, false, -1);
  } else if constexpr (std::is_same_v<CleanT, TreeNode*>) {
    return __build_tree_from_level_order(value);
  } else if constexpr (std::is_same_v<CleanT, Node*>) {
    return __build_random_list_from_json(value);
  } else {
    static_assert(!sizeof(CleanT*), "Unsupported parameter type in core wrapper");
  }
}

json __to_json_value(const std::string& value) {
  return json(value);
}

json __to_json_value(const char* value) {
  return json(value);
}

json __to_json_value(bool value) {
  return json(value);
}

template <typename T, std::enable_if_t<std::is_integral_v<T> && !std::is_same_v<T, bool>, int> = 0>
json __to_json_value(const T value) {
  return json(value);
}

template <typename T, std::enable_if_t<std::is_floating_point_v<T>, int> = 0>
json __to_json_value(const T value) {
  return json(value);
}

json __to_json_value(ListNode* head) {
  json values = json::array();
  std::unordered_set<ListNode*> visited;
  ListNode* cursor = head;
  size_t guard = 0;

  while (cursor != nullptr && guard < 10000) {
    if (visited.count(cursor) != 0) {
      break;
    }
    visited.insert(cursor);
    values.push_back(cursor->val);
    cursor = cursor->next;
    guard += 1;
  }

  return values;
}

json __to_json_value(TreeNode* root) {
  if (root == nullptr) {
    return nullptr;
  }

  json values = json::array();
  std::queue<TreeNode*> queue;
  queue.push(root);

  while (!queue.empty()) {
    TreeNode* current = queue.front();
    queue.pop();

    if (current == nullptr) {
      values.push_back(nullptr);
      continue;
    }

    values.push_back(current->val);
    queue.push(current->left);
    queue.push(current->right);
  }

  while (!values.empty() && values.back().is_null()) {
    values.erase(values.end() - 1);
  }

  return values;
}

json __to_json_value(Node* head) {
  json values = json::array();
  std::vector<Node*> nodes;
  std::unordered_map<Node*, size_t> index;

  Node* cursor = head;
  size_t guard = 0;
  while (cursor != nullptr && guard < 10000) {
    if (index.count(cursor) != 0) {
      break;
    }
    index[cursor] = nodes.size();
    nodes.push_back(cursor);
    cursor = cursor->next;
    guard += 1;
  }

  for (Node* node : nodes) {
    json pair = json::array();
    pair.push_back(node->val);
    if (node->random == nullptr || index.count(node->random) == 0) {
      pair.push_back(nullptr);
    } else {
      pair.push_back(index[node->random]);
    }
    values.push_back(pair);
  }

  return values;
}

template <typename T>
json __to_json_value(const std::vector<T>& values) {
  json result = json::array();
  for (const auto& item : values) {
    result.push_back(__to_json_value(item));
  }
  return result;
}

json __resolve_param(const std::unordered_map<std::string, json>& kv, const std::string& key) {
  const auto it = kv.find(key);
  if (it == kv.end()) {
    return nullptr;
  }
  return it->second;
}

json __arg_at(const json& args, const size_t index) {
  if (args.is_array() && index < args.size()) {
    return args[index];
  }
  return nullptr;
}

void __print_json(const json& value) {
  std::cout << value.dump();
}
`;

function buildCppCoreProgram(problemSlug, userCode) {
  const meta = getProblemMeta(problemSlug);
  const mainSource = meta.kind === "design" ? buildCppDesignMain(meta) : buildCppSolutionMain(problemSlug, meta);

  return `${CPP_CORE_RUNTIME}
${userCode}

${mainSource}
`;
}

function buildPythonRuntimeMeta(problemSlug, meta) {
  if (meta.kind === "design") {
    const constructor = meta.methods.find((item) => item.returnType === null && item.name === meta.className) ?? {
      params: []
    };
    const methods = meta.methods.filter((item) => item.returnType !== null);

    return {
      kind: "design",
      problemSlug,
      className: meta.className,
      constructor,
      methods
    };
  }

  const method = getSolutionMethod(meta);
  return {
    kind: "solution",
    problemSlug,
    className: meta.className,
    method
  };
}

function buildPythonCoreProgram(problemSlug, userCode) {
  const meta = getProblemMeta(problemSlug);
  const runtimeMeta = buildPythonRuntimeMeta(problemSlug, meta);
  const runtimeMetaJson = JSON.stringify(runtimeMeta).replace(/\\/g, "\\\\").replace(/'''/g, "\\'\\'\\'");

  return `${userCode}

import json
import sys
from collections import deque

__CORE_META = json.loads(r'''${runtimeMetaJson}''')


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


class Node:
    def __init__(self, x=0, next=None, random=None):
        self.val = int(x)
        self.next = next
        self.random = random


def _normalize_cpp_type(type_name: str) -> str:
    return " ".join(type_name.replace("*", " * ").replace("&", " & ").split()).replace(" *", "*").replace(" &", "&")


def _storage_type(type_name: str) -> str:
    t = _normalize_cpp_type(type_name)
    if t.startswith("const "):
        t = t[len("const ") :]
    if t.endswith("&"):
        t = t[:-1].strip()
    return t


def _split_top_level(text: str, delimiter: str = ",") -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    depth_square = depth_curly = depth_round = depth_angle = 0
    in_string = False
    quote = ""

    for idx, ch in enumerate(text):
        if in_string:
            current.append(ch)
            if ch == quote and (idx == 0 or text[idx - 1] != "\\\\"):
                in_string = False
            continue

        if ch in ('"', "'"):
            in_string = True
            quote = ch
            current.append(ch)
            continue

        if ch == "[":
            depth_square += 1
        elif ch == "]":
            depth_square -= 1
        elif ch == "{":
            depth_curly += 1
        elif ch == "}":
            depth_curly -= 1
        elif ch == "(":
            depth_round += 1
        elif ch == ")":
            depth_round -= 1
        elif ch == "<":
            depth_angle += 1
        elif ch == ">":
            depth_angle -= 1

        if ch == delimiter and depth_square == 0 and depth_curly == 0 and depth_round == 0 and depth_angle == 0:
            piece = "".join(current).strip()
            if piece:
                parts.append(piece)
            current = []
            continue

        current.append(ch)

    piece = "".join(current).strip()
    if piece:
        parts.append(piece)

    return parts


def _parse_value(raw: str):
    value = raw.strip()
    if value == "":
        return None

    try:
        return json.loads(value)
    except Exception:
        if value.lower() == "true":
            return True
        if value.lower() == "false":
            return False
        if value.lower() == "null":
            return None
        if len(value) >= 2 and value[0] == "'" and value[-1] == "'":
            return value[1:-1]
        try:
            if "." in value or "e" in value.lower():
                return float(value)
            return int(value)
        except Exception:
            return value


def _parse_assignments(raw: str) -> dict[str, object]:
    result: dict[str, object] = {}
    for token in _split_top_level(raw, ","):
        if "=" not in token:
            continue
        key, val = token.split("=", 1)
        key = key.strip()
        if not key:
            continue
        result[key] = _parse_value(val)
    return result


def _consume_json_array_span(text: str, start: int) -> tuple[int, int]:
    in_string = False
    quote = ""
    depth = 0

    for idx in range(start, len(text)):
        ch = text[idx]
        if in_string:
            if ch == quote and (idx == 0 or text[idx - 1] != "\\\\"):
                in_string = False
            continue

        if ch in ('"', "'"):
            in_string = True
            quote = ch
            continue

        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return start, idx

    raise ValueError("invalid design input")


def _parse_design_input(raw: str):
    text = raw.strip()
    if not text:
        return [], []

    first_open = text.find("[")
    if first_open < 0:
        return [], []

    left, right = _consume_json_array_span(text, first_open)
    ops = json.loads(text[left : right + 1])

    rest = text[right + 1 :].strip()
    if not rest:
        return ops, []

    second_open = rest.find("[")
    if second_open < 0:
        return ops, []

    args = json.loads(rest[second_open:])
    return ops, args


def _build_list(values, pos: int = -1):
    if not isinstance(values, list):
        return None

    head = None
    prev = None
    nodes = []
    for item in values:
        if item is None:
            continue
        node = ListNode(int(item))
        nodes.append(node)
        if head is None:
            head = node
        if prev is not None:
            prev.next = node
        prev = node

    if prev is not None and pos >= 0 and pos < len(nodes):
        prev.next = nodes[pos]

    return head


def _build_intersection_lists(kv: dict[str, object]):
    list_a = kv.get("listA", [])
    list_b = kv.get("listB", [])
    skip_a = int(kv.get("skipA", -1) or -1)
    skip_b = int(kv.get("skipB", -1) or -1)

    head_a = _build_list(list_a)
    nodes_a = []
    cursor = head_a
    guard = 0
    while cursor is not None and guard < 10000:
        nodes_a.append(cursor)
        cursor = cursor.next
        guard += 1

    intersection = nodes_a[skip_a] if 0 <= skip_a < len(nodes_a) else None

    head_b = None
    tail_b = None
    if isinstance(list_b, list):
        for idx, item in enumerate(list_b):
            if skip_b >= 0 and idx >= skip_b:
                break
            node = ListNode(int(item))
            if head_b is None:
                head_b = node
            if tail_b is not None:
                tail_b.next = node
            tail_b = node

    if head_b is None:
        head_b = intersection
    elif tail_b is not None:
        tail_b.next = intersection

    return head_a, head_b


def _build_tree(values):
    if not isinstance(values, list) or not values or values[0] is None:
        return None

    root = TreeNode(int(values[0]))
    queue = deque([root])
    index = 1

    while queue and index < len(values):
        node = queue.popleft()

        left = values[index]
        index += 1
        if left is not None:
            node.left = TreeNode(int(left))
            queue.append(node.left)

        if index >= len(values):
            break

        right = values[index]
        index += 1
        if right is not None:
            node.right = TreeNode(int(right))
            queue.append(node.right)

    return root


def _find_tree_node(root, target):
    if root is None:
        return None

    queue = deque([root])
    while queue:
        node = queue.popleft()
        if node.val == target:
            return node
        if node.left is not None:
            queue.append(node.left)
        if node.right is not None:
            queue.append(node.right)
    return None


def _build_random_list(values):
    if not isinstance(values, list):
        return None

    nodes = []
    for item in values:
        if isinstance(item, list) and item:
            nodes.append(Node(item[0]))
        else:
            nodes.append(Node(0))

    for i in range(len(nodes) - 1):
        nodes[i].next = nodes[i + 1]

    for i, item in enumerate(values):
        if isinstance(item, list) and len(item) >= 2 and item[1] is not None:
            random_idx = int(item[1])
            if 0 <= random_idx < len(nodes):
                nodes[i].random = nodes[random_idx]

    return nodes[0] if nodes else None


def _vector_inner_type(type_name: str) -> str:
    start = type_name.find("<")
    end = type_name.rfind(">")
    return type_name[start + 1 : end].strip()


def _convert_value(cpp_type: str, value):
    t = _storage_type(cpp_type)

    if t.startswith("vector<"):
        inner = _vector_inner_type(t)
        if not isinstance(value, list):
            return []
        return [_convert_value(inner, item) for item in value]

    if t == "int":
        return int(value or 0)
    if t == "long long":
        return int(value or 0)
    if t == "double":
        return float(value or 0)
    if t == "bool":
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        return str(value).lower() in {"true", "1", "yes"}
    if t == "string":
        return "" if value is None else str(value)
    if t == "ListNode*":
        return _build_list(value)
    if t == "TreeNode*":
        return _build_tree(value)
    if t == "Node*":
        return _build_random_list(value)

    return value


def _list_to_jsonable(head):
    values = []
    seen = set()
    cursor = head
    guard = 0
    while cursor is not None and guard < 10000:
        node_id = id(cursor)
        if node_id in seen:
            break
        seen.add(node_id)
        values.append(cursor.val)
        cursor = cursor.next
        guard += 1
    return values


def _tree_to_jsonable(root):
    if root is None:
        return None

    result = []
    queue = deque([root])
    while queue:
        node = queue.popleft()
        if node is None:
            result.append(None)
            continue
        result.append(node.val)
        queue.append(node.left)
        queue.append(node.right)

    while result and result[-1] is None:
        result.pop()
    return result


def _random_list_to_jsonable(head):
    nodes = []
    index = {}

    cursor = head
    guard = 0
    while cursor is not None and guard < 10000:
        node_id = id(cursor)
        if node_id in index:
            break
        index[node_id] = len(nodes)
        nodes.append(cursor)
        cursor = cursor.next
        guard += 1

    result = []
    for node in nodes:
        random_index = None
        if node.random is not None and id(node.random) in index:
            random_index = index[id(node.random)]
        result.append([node.val, random_index])
    return result


def _to_jsonable(value):
    if value is None:
        return None
    if isinstance(value, ListNode):
        return _list_to_jsonable(value)
    if isinstance(value, TreeNode):
        return _tree_to_jsonable(value)
    if isinstance(value, Node):
        return _random_list_to_jsonable(value)
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _to_jsonable(val) for key, val in value.items()}
    if isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


def _dump_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _run_solution(meta):
    raw = sys.stdin.read().strip()
    kv = _parse_assignments(raw)

    method = meta["method"]
    slug = meta["problemSlug"]
    params = method.get("params", [])

    intersection_pair = None
    if slug == "intersection-of-two-linked-lists":
        intersection_pair = _build_intersection_lists(kv)

    args = []
    root_value = None

    for param in params:
        name = param["name"]
        cpp_type = param["type"]

        if slug == "intersection-of-two-linked-lists" and name == "headA":
            value = intersection_pair[0]
        elif slug == "intersection-of-two-linked-lists" and name == "headB":
            value = intersection_pair[1]
        elif slug in {"linked-list-cycle", "linked-list-cycle-ii"} and name == "head":
            pos = int(kv.get("pos", -1) or -1)
            value = _build_list(kv.get("head", []), pos)
        elif slug == "lowest-common-ancestor-of-a-binary-tree" and name in {"p", "q"}:
            target = int(kv.get(name, 0) or 0)
            value = _find_tree_node(root_value, target)
        else:
            value = _convert_value(cpp_type, kv.get(name))

        if name == "root":
            root_value = value

        args.append(value)

    method_name = method["name"]
    entry = globals().get(method_name)

    if callable(entry):
        result = entry(*args)
    else:
        cls = globals().get(meta["className"]) or globals().get("Solution")
        if cls is None:
            raise RuntimeError("Solution class not found")
        instance = cls()
        method_ref = getattr(instance, method_name, None)
        if method_ref is None or not callable(method_ref):
            raise RuntimeError(f"Method not found: {method_name}")
        result = method_ref(*args)

    return_type = method.get("returnType")

    if return_type == "void":
        output = _to_jsonable(args[0] if args else None)
    elif slug == "linked-list-cycle-ii":
        output = None if result is None else result.val
    elif slug == "lowest-common-ancestor-of-a-binary-tree":
        output = None if result is None else result.val
    else:
        output = _to_jsonable(result)

    print(_dump_json(output), end="")


def _run_design(meta):
    raw = sys.stdin.read().strip()
    ops, argsets = _parse_design_input(raw)

    cls = globals().get(meta["className"])
    if cls is None:
        raise RuntimeError(f"Design class not found: {meta['className']}")

    constructor = meta.get("constructor", {"params": []})
    methods = {item["name"]: item for item in meta.get("methods", [])}

    outputs = []
    obj = None

    for idx, op in enumerate(ops):
        arglist = argsets[idx] if idx < len(argsets) and isinstance(argsets[idx], list) else []

        if op == meta["className"]:
            ctor_args = []
            for p_idx, param in enumerate(constructor.get("params", [])):
                value = arglist[p_idx] if p_idx < len(arglist) else None
                ctor_args.append(_convert_value(param["type"], value))
            obj = cls(*ctor_args)
            outputs.append(None)
            continue

        if obj is None:
            outputs.append(None)
            continue

        method = methods.get(op)
        if method is None:
            outputs.append(None)
            continue

        call_args = []
        for p_idx, param in enumerate(method.get("params", [])):
            value = arglist[p_idx] if p_idx < len(arglist) else None
            call_args.append(_convert_value(param["type"], value))

        fn = getattr(obj, op)
        result = fn(*call_args)

        if method.get("returnType") == "void":
            outputs.append(None)
        else:
            outputs.append(_to_jsonable(result))

    print(_dump_json(outputs), end="")


if __name__ == "__main__":
    if __CORE_META.get("kind") == "design":
        _run_design(__CORE_META)
    else:
        _run_solution(__CORE_META)
`;
}

export { buildCppCoreProgram, buildPythonCoreProgram };
