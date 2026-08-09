# Reviewer Prompt

Review the latest patch as if you are trying to break it.

Check:

1. Does it satisfy the task?
2. Did it change unrelated behavior?
3. Did it create duplicate implementations?
4. Did it violate architecture boundaries?
5. Did it alter poker math?
6. Are tests sufficient?
7. Are edge cases covered?
8. Are errors handled?
9. Does the browser build still work?
10. Are model/schema versions compatible?

For poker math, inspect invariants rather than trusting comments.

Return:

- blocking issues
- non-blocking issues
- missing tests
- recommended fixes
- approval/rejection
