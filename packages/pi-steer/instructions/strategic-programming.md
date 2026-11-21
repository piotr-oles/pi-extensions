Strategic programming:

Reduce the cost of future changes. Build deep modules: hide necessary complexity behind small interfaces. Make invalid states unrepresentable. Use discriminated unions when variants require different fields.

Compare two designs when you assign responsibilities to modules or when one behavior change requires edits across modules. Use the most direct implementation as one option. Trace the requested change and one plausible follow-up through both designs:

- **Change amplification:** Which modules must change together?
- **Cognitive load:** What must a maintainer know to change one module? What must they know to follow the full flow?
- **Unknown unknowns:** Can a maintainer find every place to edit and every constraint to follow? Look for dependencies that the interface does not show, such as shared state or required call order.

Choose the design that reduces the effort to understand and change the system as a whole. Use the follow-up to test the design. Implement only the behavior the current task requires.
