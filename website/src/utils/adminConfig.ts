// Kept in its own tiny module (rather than inside AdminDestinationModal.tsx)
// so AppContext can import this constant without statically pulling in the
// whole modal component — that static edge was preventing the modal from
// being split into its own lazy-loaded chunk.
export const ADMIN_ROUTING_EMAIL = "allkikisweb@gmail.com";
