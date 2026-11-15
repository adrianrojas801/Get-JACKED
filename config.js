// Public settings for the app. The publishable key is meant to be public:
// the database rules (row-level security) are what keep each person's data private.
// Never put the secret / service_role key here.
window.GJ_CONFIG = {
  url: "https://tdjogrkeovanphgorvys.supabase.co",
  key: "sb_publishable_o2d-0EGPRw7DObThGO3ssg_nNykTjlu",
  // Reminders stay hidden until this is filled in with the PUBLIC half of the push key pair
  // (README, "Optional features"). The private half goes in Supabase secrets, never here.
  vapidPublicKey: "BI2RfMUbSQO_rohDB4wBlnu3waMcgyyWFz_tMjgzJUh5f0ON50bjd98420EJK73L2BTYwc2CTHSNGCtvb4fKVKs"
};
