export const MIN_AGE_REQUIREMENT = 20;

export function calculateAge(dateOfBirth: Date, referenceDate: Date = new Date()): number {
  const birthDate = new Date(dateOfBirth);
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

export function isOver18(dateOfBirth: Date, referenceDate: Date = new Date()): boolean {
  return calculateAge(dateOfBirth, referenceDate) >= MIN_AGE_REQUIREMENT;
}

export function isAgeValid(dateOfBirth: Date, referenceDate: Date = new Date()): boolean {
  const age = calculateAge(dateOfBirth, referenceDate);
  return age >= MIN_AGE_REQUIREMENT && age <= 120;
}

export function getDateOfBirth18YearsAgo(referenceDate: Date = new Date()): Date {
  const dob = new Date(referenceDate);
  dob.setFullYear(dob.getFullYear() - MIN_AGE_REQUIREMENT);
  return dob;
}

export function parseDateOfBirth(dobString: string): Date | null {
  const date = new Date(dobString);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function formatDateOfBirth(date: Date): string {
  return date.toISOString().split("T")[0];
}
