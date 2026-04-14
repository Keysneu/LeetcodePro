UPDATE test_cases AS tc
SET expected_output = CASE
  WHEN tc.input_data = 'head = [3,2,0,-4], pos = 1' THEN '1'
  WHEN tc.input_data = 'head = [1,2], pos = 0' THEN '0'
  ELSE tc.expected_output
END
FROM problems AS p
WHERE p.id = tc.problem_id
  AND p.slug = 'linked-list-cycle-ii';

UPDATE problems
SET
  output_spec = '输出示例：1（表示入环节点索引）',
  updated_at = NOW()
WHERE slug = 'linked-list-cycle-ii';
