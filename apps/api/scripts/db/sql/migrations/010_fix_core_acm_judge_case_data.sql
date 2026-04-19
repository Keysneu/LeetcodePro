UPDATE test_cases AS tc
SET expected_output = CASE
  WHEN tc.input_data = 'intersectVal = 8, listA = [4,1,8,4,5], listB = [5,6,1,8,4,5], skipA = 2, skipB = 3' THEN '8'
  WHEN tc.input_data = 'intersectVal = 2, listA = [1,9,1,2,4], listB = [3,2,4], skipA = 3, skipB = 1' THEN '2'
  ELSE tc.expected_output
END
FROM problems AS p
WHERE p.id = tc.problem_id
  AND p.slug = 'intersection-of-two-linked-lists';

UPDATE problems
SET
  output_spec = '输出示例：8（表示相交节点值）',
  updated_at = NOW()
WHERE slug = 'intersection-of-two-linked-lists';

UPDATE test_cases AS tc
SET input_data = REPLACE(REPLACE(tc.input_data, 'l1 =', 'list1 ='), 'l2 =', 'list2 =')
FROM problems AS p
WHERE p.id = tc.problem_id
  AND p.slug = 'merge-two-sorted-lists';

UPDATE problems
SET
  input_spec = REPLACE(REPLACE(input_spec, 'l1 =', 'list1 ='), 'l2 =', 'list2 ='),
  updated_at = NOW()
WHERE slug = 'merge-two-sorted-lists';

UPDATE test_cases AS tc
SET input_data = REPLACE(tc.input_data, '''', '"')
FROM problems AS p
WHERE p.id = tc.problem_id
  AND p.slug IN ('number-of-islands', 'word-search');

UPDATE problems
SET
  input_spec = REPLACE(input_spec, '''', '"'),
  updated_at = NOW()
WHERE slug IN ('number-of-islands', 'word-search');

UPDATE test_cases AS tc
SET input_data = REPLACE(REPLACE(tc.input_data, '[`', '['), ']`', ']')
FROM problems AS p
WHERE p.id = tc.problem_id
  AND p.slug = 'find-first-and-last-position-of-element-in-sorted-array';

UPDATE problems
SET
  input_spec = REPLACE(REPLACE(input_spec, '[`', '['), ']`', ']'),
  updated_at = NOW()
WHERE slug = 'find-first-and-last-position-of-element-in-sorted-array';

UPDATE test_cases AS tc
SET input_data = CASE
  WHEN tc.input_data = '`[3,2,1,5,6,4],` k = 2' THEN 'nums = [3,2,1,5,6,4], k = 2'
  WHEN tc.input_data = '`[3,2,3,1,2,4,5,5,6], `k = 4' THEN 'nums = [3,2,3,1,2,4,5,5,6], k = 4'
  ELSE tc.input_data
END
FROM problems AS p
WHERE p.id = tc.problem_id
  AND p.slug = 'kth-largest-element-in-an-array';

UPDATE problems
SET
  input_spec = '输入示例：nums = [3,2,1,5,6,4], k = 2',
  updated_at = NOW()
WHERE slug = 'kth-largest-element-in-an-array';
