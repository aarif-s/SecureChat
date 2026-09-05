export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt?: string;
}

export interface AuthResponse {
  success: true;
  user: AuthUser;
}

export interface RegistrationResponse {
  success: true;
  user: AuthUser;
  emailVerificationRequired: true;
}
