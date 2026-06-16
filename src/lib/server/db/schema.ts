// Schema wird im nächsten Schritt aus dem ER-Diagramm umgesetzt:
// mitglieder, rollen, mitglied_rollen, dauerkarten, spiele, freigaben, bewerbungen
//
// Bei Supabase verweist "mitglieder" per FK auf auth.users statt ein eigenes
// passwort_hash-Feld zu speichern (siehe Entscheidung im ER-Diagramm).
export {};
