import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { demoStore } from '../demo/store';
import { positionLimitAllowed, tradingLocked, sellProceeds, weeklyDividend } from '../rules/stocks';
import { IconTrendingUp, IconTrendingDown, IconCoins } from '@tabler/icons-react';

function Sparkline({ data, color = '#2EE58A' }: { data: number[]; color?: string }) {
  if (data.length < 2) return <span className="sparkline" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 64, h = 32;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="sparkline">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function CrewfolioScreen() {
  const { currentLeague, memberStats, state, viewProfile } = useApp();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [buyShares, setBuyShares] = useState(1);
  const [sellShares, setSellShares] = useState(1);
  const [tradeTab, setTradeTab] = useState<'buy' | 'sell'>('buy');

  if (!currentLeague) return <div className="screen"><div className="empty">No league selected</div></div>;

  const userId = state.currentUserId;
  const myStats = memberStats.find((s) => s.memberId === userId);
  const myCoinBalance = currentLeague.members.find((m) => m.id === userId)?.coins || 0;
  const myHoldings = state.holdings.filter((h) => h.league_id === currentLeague.id && h.holder_id === userId);

  const selectedStats = selectedMemberId ? memberStats.find((s) => s.memberId === selectedMemberId) : null;
  const selectedMember = selectedMemberId ? currentLeague.members.find((m) => m.id === selectedMemberId) : null;
  const selectedPrice = selectedStats?.stockPrice || 0;
  const myExistingHolding = selectedMemberId
    ? myHoldings.find((h) => h.subject_id === selectedMemberId)
    : null;

  function canBuy() {
    if (!selectedMemberId || selectedMemberId === userId) return false;
    const netWorth = myStats?.netWorth || 0;
    const existing = myExistingHolding?.shares || 0;
    return positionLimitAllowed({
      existingShares: existing,
      buyShares,
      pricePerShare: selectedPrice,
      buyerNetWorth: netWorth,
    }) && myCoinBalance >= buyShares * selectedPrice;
  }

  function canSell() {
    if (!selectedMemberId) return false;
    const owned = myExistingHolding?.shares || 0;
    return owned >= sellShares && sellShares >= 1;
  }

  function handleBuy() {
    if (!selectedMemberId || !canBuy()) return;
    demoStore.buyStock(currentLeague!.id, userId, selectedMemberId, buyShares, selectedPrice);
    setSelectedMemberId(null);
  }

  function handleSell() {
    if (!selectedMemberId || !canSell()) return;
    demoStore.sellStock(currentLeague!.id, userId, selectedMemberId, sellShares, selectedPrice);
    setSelectedMemberId(null);
  }

  const myNetWorth = myStats?.netWorth || myCoinBalance;

  return (
    <div className="screen" style={{ paddingTop: 16 }}>
      {/* Net Worth Header */}
      <div className="card-raised" style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Net Worth
        </div>
        <div className="num" style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>
          {myNetWorth} <span style={{ fontSize: 16, color: 'var(--muted)' }}>coins</span>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
          <IconCoins size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          <span className="num">{myCoinBalance}</span> coins + <span className="num">{myNetWorth - myCoinBalance}</span> in stocks
        </div>
      </div>

      {/* Holdings */}
      {myHoldings.length > 0 && (
        <>
          <div className="section-title">My Holdings</div>
          {myHoldings.map((holding) => {
            const subjectMember = currentLeague.members.find((m) => m.id === holding.subject_id);
            const subjectStats = memberStats.find((s) => s.memberId === holding.subject_id);
            const price = subjectStats?.stockPrice || 40;
            const value = holding.shares * price;
            if (!subjectMember) return null;
            return (
              <button
                key={holding.id}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, width: '100%', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => { setSelectedMemberId(holding.subject_id); setTradeTab('sell'); }}
              >
                <Avatar
                  member={{ display_name: subjectMember.display_name, avatar_color: subjectMember.avatar_color }}
                  size={38}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{subjectMember.display_name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                    <span className="num">{holding.shares}</span> shares
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 600 }}>{value} coins</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }} className="num">@{price} each</div>
                </div>
              </button>
            );
          })}
          <div className="divider" />
        </>
      )}

      {/* Market */}
      <div className="section-title">Market</div>
      {memberStats
        .filter((s) => s.memberId !== userId)
        .sort((a, b) => b.stockPrice - a.stockPrice)
        .map((stats) => {
          const member = currentLeague.members.find((m) => m.id === stats.memberId);
          if (!member) return null;
          const priceHistory = state.stockPriceHistory
            .filter((h) => h.league_id === currentLeague.id && h.member_id === stats.memberId)
            .map((h) => h.price);
          const sparkData = priceHistory.length > 1 ? priceHistory.slice(-7) : [stats.stockPrice, stats.stockPrice];

          return (
            <button
              key={stats.memberId}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, width: '100%', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => { setSelectedMemberId(stats.memberId); setTradeTab('buy'); }}
            >
              <Avatar member={{ display_name: member.display_name, avatar_color: member.avatar_color }} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{member.display_name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Rating <span className="num">{stats.overallRating}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Sparkline data={sparkData} />
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 700, fontSize: 16 }}>{stats.stockPrice}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11 }}>coins/share</div>
                </div>
              </div>
            </button>
          );
        })}

      {/* Trade Sheet */}
      <BottomSheet
        open={!!selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
        title={selectedMember ? `${selectedMember.display_name}'s Stock` : ''}
      >
        {selectedMember && selectedStats && (
          <div style={{ paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Avatar member={{ display_name: selectedMember.display_name, avatar_color: selectedMember.avatar_color }} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  <span className="num">{selectedPrice}</span> coins/share
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Overall <span className="num">{selectedStats.overallRating}</span>
                </div>
              </div>
              <button
                onClick={() => { setSelectedMemberId(null); viewProfile(selectedMember.id); }}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 999,
                  color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  padding: '4px 12px', fontFamily: 'var(--font-sora)', flexShrink: 0,
                }}
              >
                Profile
              </button>
            </div>

            {/* Buy/Sell tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                className={`btn ${tradeTab === 'buy' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, height: 44 }}
                onClick={() => setTradeTab('buy')}
              >
                Buy
              </button>
              <button
                className={`btn ${tradeTab === 'sell' ? 'btn-danger' : 'btn-ghost'}`}
                style={{ flex: 1, height: 44 }}
                onClick={() => setTradeTab('sell')}
              >
                Sell
              </button>
            </div>

            {tradeTab === 'buy' && (
              <>
                <div className="label" style={{ marginBottom: 6 }}>Shares to buy</div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={buyShares}
                  onChange={(e) => setBuyShares(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input"
                  style={{ marginBottom: 12 }}
                />
                <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
                  Total: <span className="num" style={{ color: 'var(--text)' }}>{buyShares * selectedPrice} coins</span>
                </div>
                <button className="btn btn-primary" onClick={handleBuy} disabled={!canBuy()}>
                  Buy {buyShares} share{buyShares !== 1 ? 's' : ''}
                </button>
                {!canBuy() && myExistingHolding && (
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                    Position limit: max 40% of net worth
                  </div>
                )}
              </>
            )}

            {tradeTab === 'sell' && (
              <>
                <div style={{ marginBottom: 8, color: 'var(--muted)', fontSize: 13 }}>
                  You own <span className="num" style={{ color: 'var(--text)' }}>{myExistingHolding?.shares || 0}</span> shares
                </div>
                <div className="label" style={{ marginBottom: 6 }}>Shares to sell</div>
                <input
                  type="number"
                  min={1}
                  max={myExistingHolding?.shares || 1}
                  value={sellShares}
                  onChange={(e) => setSellShares(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input"
                  style={{ marginBottom: 12 }}
                />
                <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
                  Proceeds after 5% fee: <span className="num" style={{ color: 'var(--green)' }}>
                    {sellProceeds(sellShares, selectedPrice)} coins
                  </span>
                </div>
                <button className="btn btn-danger" onClick={handleSell} disabled={!canSell()}>
                  Sell {sellShares} share{sellShares !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
