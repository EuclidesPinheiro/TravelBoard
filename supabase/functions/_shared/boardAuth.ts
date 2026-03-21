import bcrypt from 'npm:bcryptjs@2.4.3';
import { jwtVerify, SignJWT } from 'npm:jose@5.9.6';

const PASSWORD_BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL_SECONDS = Number(
  Deno.env.get('TRAVELBOARD_ACCESS_TOKEN_TTL_SECONDS') ?? '604800',
);

export interface BoardAccessClaims {
  board_id: string;
  board_access: true;
  role: 'authenticated';
  aud: 'authenticated';
  sub: string;
}

export async function hashBoardPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, PASSWORD_BCRYPT_ROUNDS);
}

export async function verifyBoardPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('$2')) {
    return false;
  }
  return await bcrypt.compare(password, storedHash);
}

export async function issueBoardAccessToken(boardId: string): Promise<string> {
  const signingSecret = getBoardJwtSecret();

  return await new SignJWT({
    board_access: true,
    board_id: boardId,
    role: 'authenticated',
    aud: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(`board:${boardId}`)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(signingSecret);
}

export async function verifyBoardAccessToken(
  accessToken: string,
  boardId: string,
): Promise<BoardAccessClaims | null> {
  try {
    const signingSecret = getBoardJwtSecret();
    const { payload } = await jwtVerify(accessToken, signingSecret, {
      algorithms: ['HS256'],
      audience: 'authenticated',
    });

    if (payload.board_access !== true) return null;
    if (payload.board_id !== boardId) return null;
    if (payload.role !== 'authenticated') return null;
    if (payload.sub !== `board:${boardId}`) return null;

    return payload as unknown as BoardAccessClaims;
  } catch {
    return null;
  }
}

function getBoardJwtSecret(): Uint8Array {
  const rawSecret =
    Deno.env.get('TRAVELBOARD_JWT_SECRET') ??
    Deno.env.get('SUPABASE_JWT_SECRET') ??
    Deno.env.get('SUPABASE_INTERNAL_JWT_SECRET') ??
    Deno.env.get('JWT_SECRET');

  if (!rawSecret) {
    throw new Error(
      'Missing board JWT secret. Set TRAVELBOARD_JWT_SECRET (or JWT_SECRET) to the project JWT signing secret.',
    );
  }

  return new TextEncoder().encode(rawSecret);
}
