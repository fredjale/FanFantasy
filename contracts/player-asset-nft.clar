;; Player Asset NFT Contract
;; Clarity v2
;; Manages tokenized player performance assets as NFTs with dynamic stat updates

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-NFT-NOT-FOUND u101)
(define-constant ERR-INSUFFICIENT-PERMISSION u102)
(define-constant ERR-PAUSED u103)
(define-constant ERR-ZERO-ADDRESS u104)
(define-constant ERR-MAX-MINT-REACHED u105)
(define-constant ERR-INVALID-ORACLE u106)
(define-constant ERR-INVALID-METADATA u107)

;; Contract metadata
(define-constant NFT-NAME "FanFantasy Player Asset")
(define-constant NFT-SYMBOL "FFPA")
(define-constant MAX-MINT-PER-PLAYER u100) ;; Max 100 NFTs per player to ensure scarcity

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var oracle principal tx-sender) ;; Oracle for performance updates
(define-data-var total-nfts uint u0)

;; NFT data structures
(define-map nfts { id: uint } { owner: principal, player-id: uint, metadata: (string-utf8 256) })
(define-map player-mint-count { player-id: uint } uint)
(define-map approved-operators { nft-id: uint, operator: principal } bool)

;; Events for tracking
(define-trait sip-010-trait
  ((transfer (uint principal principal) (response bool uint))
   (get-owner (uint) (response (optional principal) uint))
   (get-token-uri (uint) (response (optional (string-utf8 256)) uint))))

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: is-oracle
(define-private (is-oracle)
  (is-eq tx-sender (var-get oracle))
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
    (ok true)
  )
)

;; Set oracle address
(define-public (set-oracle (new-oracle principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-oracle 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set oracle new-oracle)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Mint new player NFT
(define-public (mint (player-id uint) (recipient principal) (initial-metadata (string-utf8 256)))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (ensure-not-paused)
    (let ((current-count (default-to u0 (map-get? player-mint-count { player-id: player-id })))
          (new-id (+ (var-get total-nfts) u1)))
      (asserts! (< current-count MAX-MINT-PER-PLAYER) (err ERR-MAX-MINT-REACHED))
      (asserts! (not (is-eq initial-metadata u"")) (err ERR-INVALID-METADATA))
      (map-set nfts { id: new-id } { owner: recipient, player-id: player-id, metadata: initial-metadata })
      (map-set player-mint-count { player-id: player-id } (+ current-count u1))
      (var-set total-nfts new-id)
      (print { event: "mint", nft-id: new-id, player-id: player-id, recipient: recipient })
      (ok new-id)
    )
  )
)

;; Update NFT metadata (oracle only)
(define-public (update-metadata (nft-id uint) (new-metadata (string-utf8 256)))
  (begin
    (asserts! (is-oracle) (err ERR-INVALID-ORACLE))
    (asserts! (not (is-eq new-metadata u"")) (err ERR-INVALID-METADATA))
    (match (map-get? nfts { id: nft-id })
      nft-data
      (begin
        (map-set nfts { id: nft-id } (merge nft-data { metadata: new-metadata }))
        (print { event: "metadata-update", nft-id: nft-id, new-metadata: new-metadata })
        (ok true)
      )
      (err ERR-NFT-NOT-FOUND)
    )
  )
)

;; Transfer NFT (SIP-010 compliant)
(define-public (transfer (nft-id uint) (sender principal) (recipient principal))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (match (map-get? nfts { id: nft-id })
      nft-data
      (begin
        (asserts! (or (is-eq tx-sender (get owner nft-data))
                      (is-some (map-get? approved-operators { nft-id: nft-id, operator: tx-sender })))
                  (err ERR-INSUFFICIENT-PERMISSION))
        (map-set nfts { id: nft-id } (merge nft-data { owner: recipient }))
        (map-delete approved-operators { nft-id: nft-id, operator: tx-sender })
        (print { event: "transfer", nft-id: nft-id, from: sender, to: recipient })
        (ok true)
      )
      (err ERR-NFT-NOT-FOUND)
    )
  )
)

;; Approve operator for NFT
(define-public (approve-operator (nft-id uint) (operator principal))
  (begin
    (ensure-not-paused)
    (match (map-get? nfts { id: nft-id })
      nft-data
      (begin
        (asserts! (is-eq tx-sender (get owner nft-data)) (err ERR-INSUFFICIENT-PERMISSION))
        (map-set approved-operators { nft-id: nft-id, operator: operator } true)
        (print { event: "approve-operator", nft-id: nft-id, operator: operator })
        (ok true)
      )
      (err ERR-NFT-NOT-FOUND)
    )
  )
)

;; Revoke operator approval
(define-public (revoke-operator (nft-id uint) (operator principal))
  (begin
    (ensure-not-paused)
    (match (map-get? nfts { id: nft-id })
      nft-data
      (begin
        (asserts! (is-eq tx-sender (get owner nft-data)) (err ERR-INSUFFICIENT-PERMISSION))
        (map-delete approved-operators { nft-id: nft-id, operator: operator })
        (print { event: "revoke-operator", nft-id: nft-id, operator: operator })
        (ok true)
      )
      (err ERR-NFT-NOT-FOUND)
    )
  )
)

;; Read-only: get NFT owner (SIP-010)
(define-read-only (get-owner (nft-id uint))
  (match (map-get? nfts { id: nft-id })
    nft-data (ok (some (get owner nft-data)))
    (err ERR-NFT-NOT-FOUND)
  )
)

;; Read-only: get token URI (SIP-010)
(define-read-only (get-token-uri (nft-id uint))
  (match (map-get? nfts { id: nft-id })
    nft-data (ok (some (get metadata nft-data)))
    (err ERR-NFT-NOT-FOUND)
  )
)

;; Read-only: get total NFTs
(define-read-only (get-total-nfts)
  (ok (var-get total-nfts))
)

;; Read-only: get player mint count
(define-read-only (get-player-mint-count (player-id uint))
  (ok (default-to u0 (map-get? player-mint-count { player-id: player-id })))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: get oracle
(define-read-only (get-oracle)
  (ok (var-get oracle))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)