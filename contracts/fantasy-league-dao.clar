;; Fantasy League DAO Contract
;; Clarity v2
;; Manages decentralized governance for fantasy sports leagues with proposal and voting

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-PROPOSAL-NOT-FOUND u101)
(define-constant ERR-ALREADY-VOTED u102)
(define-constant ERR-VOTING-CLOSED u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INSUFFICIENT-VOTING-POWER u106)
(define-constant ERR-INVALID-QUORUM u107)
(define-constant ERR-INVALID-DURATION u108)
(define-constant ERR-PROPOSAL-EXECUTED u109)

;; Contract metadata
(define-constant DAO-NAME "FanFantasy League DAO")
(define-constant MINIMUM-QUORUM u10) ;; 10% of total voting power required
(define-constant MIN-VOTING-DURATION u1440) ;; ~1 day in blocks
(define-constant MAX-VOTING-DURATION u10080) ;; ~7 days in blocks

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var total-voting-power uint u0)
(define-data-var proposal-counter uint u0)

;; Data structures
(define-map proposals
  { proposal-id: uint }
  {
    proposer: principal,
    description: (string-utf8 256),
    voting-deadline: uint,
    yes-votes: uint,
    no-votes: uint,
    executed: bool,
    target-contract: (optional principal)
  }
)
(define-map votes { proposal-id: uint, voter: principal } bool)
(define-map voter-power principal uint) ;; Tracks NFT-based voting power

;; External contract for NFT integration
(define-data-var nft-contract principal tx-sender)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (print { event: "admin-transferred", new-admin: new-admin })
    (ok true)
  )
)

;; Set NFT contract address
(define-public (set-nft-contract (new-contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set nft-contract new-contract)
    (print { event: "nft-contract-updated", new-contract: new-contract })
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (print { event: "paused", status: pause })
    (ok pause)
  )
)

;; Update voter power (called by NFT contract or admin)
(define-public (update-voter-power (voter principal) (power uint))
  (begin
    (asserts! (or (is-admin) (is-eq tx-sender (var-get nft-contract))) (err ERR-NOT-AUTHORIZED))
    (let ((current-power (default-to u0 (map-get? voter-power voter))))
      (map-set voter-power voter power)
      (var-set total-voting-power (+ (- (var-get total-voting-power) current-power) power))
      (print { event: "voter-power-updated", voter: voter, power: power })
      (ok true)
    )
  )
)

;; Create a new proposal
(define-public (create-proposal (description (string-utf8 256)) (voting-duration uint) (target-contract (optional principal)))
  (begin
    (ensure-not-paused)
    (asserts! (> (len description) u0) (err ERR-INVALID-DURATION))
    (asserts! (and (>= voting-duration MIN-VOTING-DURATION) (<= voting-duration MAX-VOTING-DURATION)) (err ERR-INVALID-DURATION))
    (let ((voter-power (default-to u0 (map-get? voter-power tx-sender)))
          (proposal-id (+ (var-get proposal-counter) u1))
          (deadline (+ block-height voting-duration)))
      (asserts! (> voter-power u0) (err ERR-INSUFFICIENT-VOTING-POWER))
      (map-set proposals
        { proposal-id: proposal-id }
        {
          proposer: tx-sender,
          description: description,
          voting-deadline: deadline,
          yes-votes: u0,
          no-votes: u0,
          executed: false,
          target-contract: target-contract
        }
      )
      (var-set proposal-counter proposal-id)
      (print { event: "proposal-created", proposal-id: proposal-id, proposer: tx-sender, description: description })
      (ok proposal-id)
    )
  )
)

;; Vote on a proposal
(define-public (vote (proposal-id uint) (vote-yes bool))
  (begin
    (ensure-not-paused)
    (match (map-get? proposals { proposal-id: proposal-id })
      proposal
      (begin
        (asserts! (< block-height (get voting-deadline proposal)) (err ERR-VOTING-CLOSED))
        (asserts! (not (get executed proposal)) (err ERR-PROPOSAL-EXECUTED))
        (asserts! (is-none (map-get? votes { proposal-id: proposal-id, voter: tx-sender })) (err ERR-ALREADY-VOTED))
        (let ((voter-power (default-to u0 (map-get? voter-power tx-sender))))
          (asserts! (> voter-power u0) (err ERR-INSUFFICIENT-VOTING-POWER))
          (map-set votes { proposal-id: proposal-id, voter: tx-sender } vote-yes)
          (map-set proposals
            { proposal-id: proposal-id }
            (merge proposal {
              yes-votes: (if vote-yes (+ (get yes-votes proposal) voter-power) (get yes-votes proposal)),
              no-votes: (if vote-yes (get no-votes proposal) (+ (get no-votes proposal) voter-power))
            })
          )
          (print { event: "vote-cast", proposal-id: proposal-id, voter: tx-sender, vote-yes: vote-yes })
          (ok true)
        )
      )
      (err ERR-PROPOSAL-NOT-FOUND)
    )
  )
)

;; Execute a proposal if quorum and majority reached
(define-public (execute-proposal (proposal-id uint))
  (begin
    (ensure-not-paused)
    (match (map-get? proposals { proposal-id: proposal-id })
      proposal
      (begin
        (asserts! (>= block-height (get voting-deadline proposal)) (err ERR-VOTING-CLOSED))
        (asserts! (not (get executed proposal)) (err ERR-PROPOSAL-EXECUTED))
        (let ((total-votes (+ (get yes-votes proposal) (get no-votes proposal)))
              (quorum (* (var-get total-voting-power) MINIMUM-QUORUM)))
          (asserts! (>= total-votes quorum) (err ERR-INVALID-QUORUM))
          (asserts! (> (get yes-votes proposal) (get no-votes proposal)) (err ERR-INVALID-QUORUM))
          (map-set proposals
            { proposal-id: proposal-id }
            (merge proposal { executed: true })
          )
          (print { event: "proposal-executed", proposal-id: proposal-id })
          (ok true)
        )
      )
      (err ERR-PROPOSAL-NOT-FOUND)
    )
  )
)

;; Read-only: get proposal details
(define-read-only (get-proposal (proposal-id uint))
  (match (map-get? proposals { proposal-id: proposal-id })
    proposal (ok proposal)
    (err ERR-PROPOSAL-NOT-FOUND)
  )
)

;; Read-only: get voter power
(define-read-only (get-voter-power (voter principal))
  (ok (default-to u0 (map-get? voter-power voter)))
)

;; Read-only: get total voting power
(define-read-only (get-total-voting-power)
  (ok (var-get total-voting-power))
)

;; Read-only: get proposal count
(define-read-only (get-proposal-count)
  (ok (var-get proposal-counter))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: get NFT contract
(define-read-only (get-nft-contract)
  (ok (var-get nft-contract))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)