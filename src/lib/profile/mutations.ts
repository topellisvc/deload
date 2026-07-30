import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ExperienceLevel,
  PersonalRecord,
  ProfileLengthUnit,
  ProfileMassUnit,
  ProfileSex,
} from "@/lib/supabase/types";
import type { InjuryProfile } from "@/lib/programs/generate/types";

/**
 * Saves the athlete's standing injury profile (migration 0047) — called at
 * the end of program generation with whatever InjuryProfile the
 * questionnaire just collected, so Training Mode's Rule 4 has something
 * durable to read later instead of that answer evaporating with the
 * generate-program form's local state. A plain upsert, same as
 * upsertPersonalRecord below: this describes the athlete's *current*
 * standing flags, not a history of past ones, so the latest submission
 * simply overwrites whatever was there before.
 */
export async function upsertAthleteInjuryProfile(
  supabase: SupabaseClient,
  params: { athleteId: string; injuries: InjuryProfile }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("athlete_injury_profiles")
    .upsert({ athlete_id: params.athleteId, injuries: params.injuries, updated_at: new Date().toISOString() }, { onConflict: "athlete_id" });
  return { error: error ? "Couldn't save your injury profile. Try again." : null };
}

export interface ProfileUpdate {
  display_name: string | null;
  height_value: number | null;
  height_unit: ProfileLengthUnit | null;
  weight_value: number | null;
  weight_unit: ProfileMassUnit | null;
  goal: string | null;
  bio: string | null;
  date_of_birth: string | null;
  sex: ProfileSex | null;
  experience_level: ExperienceLevel | null;
  training_style: string | null;
}

/**
 * Saves every editable field on /profile in one call. RLS ("profiles are
 * editable by their owner") already permits this — no new policy needed.
 * Doesn't touch role/role_selected; that's a separate, deliberate action
 * (see lib/coaching/mutations.ts:chooseRole), not something bundled into
 * a general profile save.
 */
export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: ProfileUpdate
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  return { error: error ? "Couldn't save your profile. Try again." : null };
}

/**
 * Saves one PR. A plain upsert on (user_id, record_type) — there's only
 * ever one current value per type (see migration 0009), not a history,
 * so setting a new value just overwrites the old one.
 */
export async function upsertPersonalRecord(
  supabase: SupabaseClient,
  userId: string,
  params: { recordType: string; valueNumber: number; unit: string; achievedOn?: string | null }
): Promise<{ record: PersonalRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from("personal_records")
    .upsert(
      {
        user_id: userId,
        record_type: params.recordType,
        value_number: params.valueNumber,
        unit: params.unit,
        achieved_on: params.achievedOn ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,record_type" }
    )
    .select()
    .single();

  if (error) return { record: null, error: "Couldn't save that PR. Try again." };
  return { record: data as PersonalRecord, error: null };
}

export async function deletePersonalRecord(
  supabase: SupabaseClient,
  recordId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("personal_records").delete().eq("id", recordId);
  return { error: error ? "Couldn't remove that PR. Try again." : null };
}
