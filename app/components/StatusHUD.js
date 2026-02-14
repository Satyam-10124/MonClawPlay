'use client'

import { useState, useEffect } from 'react'
import styles from './StatusHUD.module.css'

export default function StatusHUD({ groupData }) {
    const [arenaData, setArenaData] = useState(null)

    const isLive = groupData?.debateStatus === 'active';
    const isVoting = groupData?.debateStatus === 'voting';

    const msgCount = groupData?.messages?.filter(m => m.type === 'argument').length || 0;
    const round = Math.floor(msgCount / 2) + 1;

    // Poll on-chain arena status
    useEffect(() => {
        if (!groupData?.groupId) return
        const fetchArena = async () => {
            try {
                const res = await fetch(`/api/arena/status?groupId=${groupData.groupId}`)
                const data = await res.json()
                if (data.hasArena) setArenaData(data)
            } catch (e) { /* silent */ }
        }
        fetchArena()
        const interval = setInterval(fetchArena, 10000)
        return () => clearInterval(interval)
    }, [groupData?.groupId])

    const hasArena = arenaData?.hasArena
    const explorer = arenaData?.explorer || 'https://testnet.monadscan.com'

    return (
        <div className={styles.hud}>
            <div className={styles.brandSection}>
                <div className={styles.brand}>MONCLAW ARENA</div>
                <div className={styles.chainBadge}>
                    <span className={styles.chainDot}></span>
                    MONAD
                </div>
            </div>

            <div className={styles.centerStats}>
                <div className={styles.statGroup}>
                    <span className={styles.label}>ROUND</span>
                    <span className={styles.value}>{round > 5 ? 'Voting' : `0${round}/05`}</span>
                </div>

                <div className={styles.statGroup}>
                    <span className={styles.label}>PROTOCOL</span>
                    <span className={styles.value}>DEBATE v3</span>
                </div>

                <div className={styles.statGroup}>
                    <span className={styles.label}>STATUS</span>
                    <span className={styles.liveIndicator}>
                        <div className={`${styles.dot} ${isVoting ? styles.votingDot : ''}`}></div>
                        {isVoting ? 'VOTING' : 'LIVE'}
                    </span>
                </div>

                {hasArena && (
                    <div className={styles.statGroup}>
                        <span className={styles.label}>ON-CHAIN</span>
                        <a
                            href={arenaData.arena?.contractUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.chainLink}
                        >
                            {arenaData.onChain?.totalPot ? `${arenaData.onChain.totalPot} MON` : 'ACTIVE'}
                        </a>
                    </div>
                )}
            </div>

            <div className={styles.matchId}>
                {hasArena && arenaData.arena?.txHash && (
                    <a
                        href={`${explorer}/tx/${arenaData.arena.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.txLink}
                    >
                        TX: {arenaData.arena.txHash.slice(0, 8)}...
                    </a>
                )}
                <span>ID: {groupData?.groupId ? groupData.groupId.toUpperCase() : 'SYSTEM'}</span>
            </div>
        </div>
    )
}
