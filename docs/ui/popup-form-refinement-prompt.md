# Reusable prompt: future popup and form refinement

This is a prompt for a separately approved future pass, not authorization to
change additional screens as part of the Add Staff refinement.

---

Refine the approved popups and forms in DigiQ using its existing styling, shared
controls, compact spacing tokens and consolidated CSS conventions. Do not
introduce a new visual design or broadly override global styles.

Before editing, inventory creation, editing, onboarding, hidden tabs and
role-specific variants. Agree the exact screens in scope. Preserve their
permissions, data-loading contracts, saved-name hydration, validation, passwords,
dirty/discard guards, save behavior and navigation.

Put prerequisite choices before the details that depend on them, in both DOM
and keyboard order. Use short, everyday headings. Remove redundant introductions.
Align related labels and control/value areas where space permits. Keep read-only
values clearly identifiable and display real names rather than internal IDs;
allow long values to wrap.

Move optional explanations into adjacent, accessibly named information help.
Keep required markers, correction instructions, errors, loading/retry feedback
and consequential restrictions visible. Reuse the shared help behavior: hover,
keyboard focus, Escape, touch toggle and outside dismissal; no competing overlays
or reopening after dismissal.

Keep spacing compact without clipping controls or crowding touch targets. Ensure
footers and all fields remain reachable at 390px, 768px, 1024×640, ordinary desktop
widths and 200% zoom/reflow. Include long names, multiple errors, open selectors,
short viewports and keyboard scrolling.

Use actual application CSS when verifying rendered screens. Run typechecks,
build, inventory freshness and relevant existing tests. Record screenshots and
geometry evidence, distinguish fictional fixtures from authenticated roles, and
report untested paths explicitly. Do not create real accounts, send live messages,
change backend policy, deploy, or alter ticket/PDF/export layouts without separate
approval.
