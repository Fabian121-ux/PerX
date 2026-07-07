# PerX Risk and Regulatory Map

This document classifies features by their inherent risk and regulatory dependency. The platform must implement appropriate controls and seek necessary compliance clearance before activating elevated or regulated features.

## Standard Platform Features
These features carry baseline operational and moderation risks but generally do not trigger strict financial regulations.

* Profiles
* Listings
* Search
* Messaging
* Reviews

## Elevated-Risk Marketplace Features
These features introduce financial or reputational risks to participants and the ecosystem, requiring robust internal controls, logging, and dispute mechanisms.

* Deals
* Milestones
* Disputes
* Verification
* Fraud prevention

## Regulated or Provider-Dependent Features
These features are strictly dependent on legal frameworks, financial regulations, and third-party provider agreements. **They must not be presented as active capabilities until formally cleared.**

* Live escrow
* Payment custody
* Wallets
* Investments
* Lending
* Securities
* Cross-border settlement
* Insurance

### Requirements for Regulated Features
Any regulated feature requires the following before implementation or activation:
* Legal review
* Licensing analysis
* Compliance controls
* Provider agreements
* Identity verification (KYC/AML)
* Transaction monitoring
* Data-protection review
