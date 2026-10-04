import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BottomSheet } from '../components/BottomSheet';
import { Avatar } from '../components/Avatar';
import { parsePuzzle, validatePuzzleDate } from '../rules/puzzles';
import { IconChevronRight } from '@tabler/icons-react';
import type { Match } from '../demo/store';

type LogStep = 'choose' | 'log_match' | 'paste_puzzle' | 'off_books';

interface MatchForm {
  game_id: string;
  opponent_id: string;
  result: 'win' | 'loss' | 'draw' | '';
  score_a: string;
  score_b: string;
  stars_a: string;
  stars_b: string;
  hasFifaTeams: boolean;
}

export function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentLeague, state, actions } = useApp();
  const [step, setStep] = useState<LogStep>('choose');
  const [form, setForm] = useState<MatchForm>({
    game_id: 'fifa',
    opponent_id: '',
    result: '',
    score_a: '',
    score_b: '',
    stars_a: '',
    stars_b: '',
    hasFifaTeams: false,
  });
  const [puzzleText, setPuzzleText] = useState('');
  const [puzzleError, setPuzzleError] = useState('');
  const [duplicateMatch, setDuplicateMatch] = useState<Match | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!currentLeague) return null;

  const userId = state.currentUserId;
  const teammates = currentLeague.members.filter((m) => m.id !== userId);
  const mainGames = currentLeague.games.filter((g) => g.type === '1v1');
  const puzzleGames = currentLeague.games.filter((g) => g.type === 'puzzle');

  function handleClose() {
    setStep('choose');
    setForm({ game_id: 'fifa', opponent_id: '', result: '', score_a: '', score_b: '', stars_a: '', stars_b: '', hasFifaTeams: false });
    setPuzzleText('');
    setPuzzleError('');
    setDuplicateMatch(null);
    setSubmitted(false);
    onClose();
  }

  function checkDuplicate() {
    if (!form.opponent_id) return null;
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    return state.matches.find(
      (m) =>
        m.league_id === currentLeague!.id &&
        m.game_id === form.game_id &&
        m.status === 'pending' &&
        m.logged_at > threeHoursAgo &&
        ((m.player_a_id === form.opponent_id && m.player_b_id === userId) ||
          (m.player_a_id === userId && m.player_b_id === form.opponent_id))
    ) || null;
  }

  function handleLogMatch(forceNew = false) {
    if (!form.opponent_id || !form.result) return;

    if (!forceNew) {
      const dup = checkDuplicate();
      if (dup && !duplicateMatch) {
        setDuplicateMatch(dup);
        return;
      }
    }

    const scoreA = form.score_a ? parseInt(form.score_a) : undefined;
    const scoreB = form.score_b ? parseInt(form.score_b) : undefined;
    const starsA = form.hasFifaTeams && form.stars_a ? parseFloat(form.stars_a) : undefined;
    const starsB = form.hasFifaTeams && form.stars_b ? parseFloat(form.stars_b) : undefined;

    actions.logMatch({
      leagueId: currentLeague!.id,
      gameId: form.game_id,
      opponentId: form.opponent_id,
      result: form.result as 'win' | 'loss' | 'draw',
      scoreA,
      scoreB,
      starsA,
      starsB,
    });

    setSubmitted(true);
  }

  function handlePuzzlePaste() {
    const parsed = parsePuzzle(puzzleText);
    if (!parsed) {
      setPuzzleError('Could not parse puzzle. Paste the full share text.');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (!validatePuzzleDate(parsed.type, parsed.puzzleNumber, today)) {
      setPuzzleError(`Puzzle #${parsed.puzzleNumber} does not match today's date. Allowed within 1 day.`);
      return;
    }
    const already = state.puzzleSubmissions.find(
      (s) =>
        s.league_id === currentLeague!.id &&
        s.member_id === userId &&
        s.game_id === parsed.type &&
        s.puzzle_number === parsed.puzzleNumber
    );
    if (already) {
      setPuzzleError(`You already posted ${parsed.type} #${parsed.puzzleNumber} today.`);
      return;
    }
    actions.submitPuzzle({
      leagueId: currentLeague!.id,
      gameId: parsed.type,
      puzzleNumber: parsed.puzzleNumber,
      puzzleDate: today,
      score: parsed.score,
      hardMode: parsed.hardMode,
      emojiGrid: parsed.emojiGrid,
      rawText: puzzleText,
    });
    setSubmitted(true);
  }

  const opponent = teammates.find((m) => m.id === form.opponent_id);
  const dupOpponent = duplicateMatch
    ? currentLeague!.members.find(
        (m) => m.id === duplicateMatch.player_a_id || m.id === duplicateMatch.player_b_id
      )
    : null;

  return (
    <BottomSheet open={open} onClose={handleClose}>
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Logged!</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            {step === 'log_match' ? 'Waiting for confirmation from your opponent.' : 'Puzzle posted.'}
          </div>
          <button className="btn btn-primary" onClick={handleClose}>Done</button>
        </div>
      ) : duplicateMatch ? (
        <div style={{ padding: '16px 0' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Heads up</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
            {dupOpponent?.display_name} already logged {form.game_id === 'fifa' ? 'FIFA' : form.game_id}{' '}
            {duplicateMatch.score_a !== undefined ? `${duplicateMatch.score_a}-${duplicateMatch.score_b}` : ''}{' '}
            {(new Date().getTime() - new Date(duplicateMatch.logged_at).getTime()) < 3600000
              ? `${Math.round((new Date().getTime() - new Date(duplicateMatch.logged_at).getTime()) / 60000)} minutes ago`
              : 'recently'}
            . Same game?
          </div>
          <button
            className="btn btn-primary"
            style={{ marginBottom: 8 }}
            onClick={() => {
              actions.confirmMatch(duplicateMatch.id);
              setSubmitted(true);
            }}
          >
            Confirm it
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setDuplicateMatch(null);
              handleLogMatch(true); // skip dup check this time
            }}
          >
            No, new game
          </button>
        </div>
      ) : step === 'choose' ? (
        <div style={{ padding: '8px 0 16px' }}>
          <div className="sheet-title" style={{ padding: '0 0 16px' }}>Log</div>
          <button
            className="card"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 8, cursor: 'pointer' }}
            onClick={() => setStep('log_match')}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Log a match</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>FIFA, GamePigeon, 8 Ball...</div>
            </div>
            <IconChevronRight size={18} color="var(--muted)" />
          </button>
          <button
            className="card"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 8, cursor: 'pointer' }}
            onClick={() => setStep('paste_puzzle')}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Paste a puzzle</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Wordle, Connections, Krillion, Ballpark</div>
            </div>
            <IconChevronRight size={18} color="var(--muted)" />
          </button>
          <button
            className="card"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
            onClick={() => setStep('off_books')}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Off the Books</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Bowling, pool, mini golf...</div>
            </div>
            <IconChevronRight size={18} color="var(--muted)" />
          </button>
        </div>
      ) : step === 'paste_puzzle' ? (
        <div style={{ padding: '8px 0 16px' }}>
          <div className="sheet-title" style={{ padding: '0 0 12px' }}>Paste a puzzle</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
            Paste the share text from Wordle, Connections, Krillion, or Ballpark.
          </div>
          <textarea
            className="input"
            style={{ minHeight: 120, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 13 }}
            placeholder="Wordle 1,234 3/6..."
            value={puzzleText}
            onChange={(e) => { setPuzzleText(e.target.value); setPuzzleError(''); }}
          />
          {puzzleError && (
            <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{puzzleError}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep('choose')}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePuzzlePaste} disabled={!puzzleText.trim()}>
              Post
            </button>
          </div>
        </div>
      ) : step === 'off_books' ? (
        <div style={{ padding: '8px 0 16px' }}>
          <div className="sheet-title" style={{ padding: '0 0 12px' }}>Off the Books</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
            Casual games don't affect ratings. Coming soon for more game types.
          </div>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setStep('choose')}>Back</button>
        </div>
      ) : (
        /* Log match form */
        <div style={{ padding: '8px 0 16px' }}>
          <div className="sheet-title" style={{ padding: '0 0 12px' }}>Log a match</div>

          {/* Game selector */}
          <div className="label" style={{ marginBottom: 6 }}>Game</div>
          <div className="chips-row" style={{ marginBottom: 16 }}>
            {mainGames.map((g) => (
              <button
                key={g.id}
                className={`chip${form.game_id === g.id ? ' active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, game_id: g.id }))}
              >
                {g.name.replace('GamePigeon ', '').replace('FIFA / EA FC', 'FIFA')}
              </button>
            ))}
          </div>

          {/* Opponent selector */}
          <div className="label" style={{ marginBottom: 6 }}>Opponent</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {teammates.map((m) => (
              <button
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  background: form.opponent_id === m.id ? 'rgba(46,229,138,0.1)' : 'var(--raised)',
                  border: `1px solid ${form.opponent_id === m.id ? 'rgba(46,229,138,0.4)' : 'var(--border)'}`,
                  borderRadius: 10, cursor: 'pointer',
                }}
                onClick={() => setForm((f) => ({ ...f, opponent_id: m.id }))}
              >
                <Avatar member={m} size={32} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{m.display_name}</span>
                {form.opponent_id === m.id && <span style={{ marginLeft: 'auto', color: 'var(--green)' }}>✓</span>}
              </button>
            ))}
          </div>

          {/* Result */}
          <div className="label" style={{ marginBottom: 6 }}>Result</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['win', 'draw', 'loss'] as const).map((r) => (
              <button
                key={r}
                className={`btn ${form.result === r ? (r === 'win' ? 'btn-primary' : r === 'loss' ? 'btn-danger' : 'btn-secondary') : 'btn-ghost'}`}
                style={{ flex: 1, height: 44, textTransform: 'capitalize' }}
                onClick={() => setForm((f) => ({ ...f, result: r }))}
              >
                {r === 'win' ? 'I won' : r === 'draw' ? 'Draw' : 'I lost'}
              </button>
            ))}
          </div>

          {/* FIFA options */}
          {form.game_id === 'fifa' && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div className="label" style={{ marginBottom: 4 }}>My score</div>
                  <input type="number" min={0} max={99} className="input" placeholder="0" value={form.score_a}
                    onChange={(e) => setForm((f) => ({ ...f, score_a: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="label" style={{ marginBottom: 4 }}>Their score</div>
                  <input type="number" min={0} max={99} className="input" placeholder="0" value={form.score_b}
                    onChange={(e) => setForm((f) => ({ ...f, score_b: e.target.value }))} />
                </div>
              </div>
              <button
                className="btn btn-ghost"
                style={{ marginBottom: 16, width: '100%', fontSize: 13 }}
                onClick={() => setForm((f) => ({ ...f, hasFifaTeams: !f.hasFifaTeams }))}
              >
                {form.hasFifaTeams ? 'Remove team ratings' : '+ Add team ratings (optional)'}
              </button>
              {form.hasFifaTeams && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div className="label" style={{ marginBottom: 4 }}>My team stars</div>
                    <input type="number" min={0.5} max={5} step={0.5} className="input" placeholder="3.5" value={form.stars_a}
                      onChange={(e) => setForm((f) => ({ ...f, stars_a: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="label" style={{ marginBottom: 4 }}>Their stars</div>
                    <input type="number" min={0.5} max={5} step={0.5} className="input" placeholder="3.5" value={form.stars_b}
                      onChange={(e) => setForm((f) => ({ ...f, stars_b: e.target.value }))} />
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep('choose')}>Back</button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={() => handleLogMatch()}
              disabled={!form.opponent_id || !form.result}
            >
              Log match
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
