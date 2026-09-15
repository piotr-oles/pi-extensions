Black-box testing:

Test each module through its interface. Treat implementation as opaque. Assert only contracted observables: return values, errors, interface events, and state changes visible through an interface.

Tests must remain valid when implementation changes without a change to interface behavior. Assert outcomes, not private state, internal algorithms, collaborator calls, call counts, or call order.
