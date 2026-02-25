import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AdminFeedbackEntry } from '@midi-invaders/shared';
import { AlertCircle, LogOut, RefreshCcw, ShieldCheck } from 'lucide-react';
import {
  fetchAdminFeedback,
  requestAdminOtp,
  verifyAdminOtp,
} from '@/services/adminApi';
import {
  clearStoredAdminSession,
  persistAdminSession,
  readStoredAdminSession,
  type StoredAdminSession,
} from '@/services/sessionStorage';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const DEFAULT_ADMIN_EMAIL = 'tharindarodrigo@gmail.com';

type AuthStep = 'email' | 'otp' | 'authenticated';
type ViewStatus = 'idle' | 'loading' | 'success' | 'error';

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const ratingStars = (rating: number): string => `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;

export default function App() {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [otp, setOtp] = useState('');
  const [session, setSession] = useState<StoredAdminSession | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [feedbackEntries, setFeedbackEntries] = useState<AdminFeedbackEntry[]>([]);
  const [viewStatus, setViewStatus] = useState<ViewStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadFeedback = useCallback(async (token: string) => {
    setViewStatus('loading');
    try {
      const response = await fetchAdminFeedback(token, 150);
      setFeedbackEntries(response.entries);
      setViewStatus('success');
      setStatusMessage(null);
    } catch (error) {
      setViewStatus('error');
      const message = error instanceof Error
        ? error.message
        : 'Unable to fetch feedback right now.';
      setStatusMessage(message);
      throw error;
    }
  }, []);

  useEffect(() => {
    const storedSession = readStoredAdminSession();
    if (!storedSession) {
      clearStoredAdminSession();
      return;
    }

    setSession(storedSession);
    setEmail(storedSession.admin.email);
    setStep('authenticated');
    void loadFeedback(storedSession.token).catch(() => {
      clearStoredAdminSession();
      setSession(null);
      setStep('email');
    });
  }, [loadFeedback]);

  const requestedOtpExpiry = useMemo(() => {
    if (!otpExpiresAt) {
      return null;
    }

    return formatTimestamp(otpExpiresAt);
  }, [otpExpiresAt]);

  const handleRequestOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    setViewStatus('loading');
    setStatusMessage(null);

    try {
      const response = await requestAdminOtp(normalizedEmail);
      setEmail(normalizedEmail);
      setStep('otp');
      setOtp('');
      setOtpExpiresAt(response.expiresAt);
      setViewStatus('success');
      setStatusMessage('OTP sent. Check your inbox and enter the 6-digit code.');
    } catch (error) {
      setViewStatus('error');
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to request OTP. Please try again.',
      );
    }
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    const cleanedOtp = otp.trim();

    setViewStatus('loading');
    setStatusMessage(null);

    try {
      const response = await verifyAdminOtp({
        email: normalizedEmail,
        otp: cleanedOtp,
      });

      const nextSession: StoredAdminSession = {
        token: response.token,
        expiresAt: response.expiresAt,
        admin: response.admin,
      };

      persistAdminSession(nextSession);
      setSession(nextSession);
      setStep('authenticated');
      await loadFeedback(response.token);
      setViewStatus('success');
      setStatusMessage(null);
    } catch (error) {
      setViewStatus('error');
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to verify OTP. Please try again.',
      );
    }
  };

  const handleRefreshFeedback = async () => {
    if (!session) {
      return;
    }

    try {
      await loadFeedback(session.token);
    } catch {
      clearStoredAdminSession();
      setSession(null);
      setStep('email');
    }
  };

  const handleLogout = () => {
    clearStoredAdminSession();
    setSession(null);
    setFeedbackEntries([]);
    setStep('email');
    setOtp('');
    setOtpExpiresAt(null);
    setViewStatus('idle');
    setStatusMessage(null);
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-3">
          <Badge variant="secondary" className="w-fit">MIDI Invaders</Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Admin Feedback Console
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            Passwordless login with email OTP. Review recent player feedback and risk flags in one place.
          </p>
        </header>

        {statusMessage ? (
          <Alert variant={viewStatus === 'error' ? 'destructive' : 'default'}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{viewStatus === 'error' ? 'Request failed' : 'Status'}</AlertTitle>
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : null}

        {(step === 'email' || step === 'otp') ? (
          <Card className="max-w-xl border-slate-200/80 bg-white/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl">Secure admin sign in</CardTitle>
              <CardDescription>
                Enter your admin email to receive a one-time password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 'email' ? (
                <form className="space-y-4" onSubmit={handleRequestOtp}>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Admin Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={viewStatus === 'loading'}>
                    {viewStatus === 'loading' ? 'Sending OTP...' : 'Send OTP'}
                  </Button>
                </form>
              ) : null}

              {step === 'otp' ? (
                <form className="space-y-4" onSubmit={handleVerifyOtp}>
                  <div className="space-y-2">
                    <Label htmlFor="admin-otp">One-time password</Label>
                    <Input
                      id="admin-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      minLength={6}
                      maxLength={6}
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/[^0-9]/gu, ''))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button type="submit" disabled={viewStatus === 'loading'}>
                      {viewStatus === 'loading' ? 'Verifying...' : 'Verify OTP'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setStep('email');
                        setOtp('');
                        setStatusMessage(null);
                      }}
                      disabled={viewStatus === 'loading'}
                    >
                      Use another email
                    </Button>
                  </div>
                  {requestedOtpExpiry ? (
                    <p className="text-xs text-muted-foreground">
                      This OTP expires at {requestedOtpExpiry}.
                    </p>
                  ) : null}
                </form>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {step === 'authenticated' && session ? (
          <Card className="border-slate-200/80 bg-white/90 backdrop-blur">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Player feedback</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Signed in as {session.admin.name} ({session.admin.email})
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleRefreshFeedback()}
                    disabled={viewStatus === 'loading'}
                  >
                    <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                    Refresh
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="mr-1 h-3.5 w-3.5" />
                    Logout
                  </Button>
                </div>
              </div>
              <Separator />
            </CardHeader>
            <CardContent>
              {viewStatus === 'loading' ? (
                <p className="text-sm text-muted-foreground">Loading feedback...</p>
              ) : null}

              {feedbackEntries.length === 0 && viewStatus !== 'loading' ? (
                <p className="text-sm text-muted-foreground">No feedback submissions yet.</p>
              ) : null}

              {feedbackEntries.length > 0 ? (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Feedback</TableHead>
                          <TableHead>Context</TableHead>
                          <TableHead>Risk Flags</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feedbackEntries.map((entry) => (
                          <TableRow key={entry.feedbackId}>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatTimestamp(entry.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{ratingStars(entry.rating)} ({entry.rating})</Badge>
                            </TableCell>
                            <TableCell className="max-w-[420px]">
                              <p className="line-clamp-3 text-sm leading-6">
                                {entry.feedback || '(No written message)'}
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline">{entry.mode}</Badge>
                                <Badge variant="outline">lvl {entry.difficulty}</Badge>
                                <Badge variant="outline">wave {entry.wave}</Badge>
                                <Badge variant="outline">{entry.inputMode}</Badge>
                                <Badge variant="outline">score {entry.score}</Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {entry.riskFlags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {entry.riskFlags.map((flag) => (
                                    <Badge key={`${entry.feedbackId}-${flag}`} variant="destructive">
                                      {flag}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">None</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {feedbackEntries.map((entry) => (
                      <Card key={entry.feedbackId} className="border-slate-200 bg-slate-50/80 shadow-none">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="secondary">{ratingStars(entry.rating)} ({entry.rating})</Badge>
                            <span className="text-xs text-muted-foreground">{formatTimestamp(entry.createdAt)}</span>
                          </div>
                          <p className="text-sm leading-6">{entry.feedback || '(No written message)'}</p>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">{entry.mode}</Badge>
                            <Badge variant="outline">lvl {entry.difficulty}</Badge>
                            <Badge variant="outline">wave {entry.wave}</Badge>
                            <Badge variant="outline">{entry.inputMode}</Badge>
                          </div>
                          {entry.riskFlags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {entry.riskFlags.map((flag) => (
                                <Badge key={`${entry.feedbackId}-mobile-${flag}`} variant="destructive">
                                  {flag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
