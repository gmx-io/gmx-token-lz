use crate::*;

#[account]
#[derive(InitSpace)]
pub struct OFTStore {
    // immutable
    pub oft_type: OFTType,
    pub ld2sd_rate: u64,
    pub token_mint: Pubkey,
    pub token_escrow: Pubkey, // this account is used to hold TVL and fees
    pub endpoint_program: Pubkey,
    pub bump: u8,
    // mutable
    pub tvl_ld: u64, // total value locked. if oft_type is Native, it is always 0.
    // configurable
    pub admin: Pubkey,
    pub default_fee_bps: u16,
    pub paused: bool,
    pub pauser: Option<Pubkey>,
    pub unpauser: Option<Pubkey>,
    // One or more accounts that can override the rate limit. This should affect all peers.
    #[max_len(16)]
    pub rate_limit_override: Vec<Pubkey>,
    pub rate_limit_override_count: u8,
    pub max_rate_limit_overrides: u8, // Hardcoded to 16
}

#[derive(InitSpace, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum OFTType {
    Native,
    Adapter,
}

impl OFTStore {
    pub fn ld2sd(&self, amount_ld: u64) -> u64 {
        amount_ld / self.ld2sd_rate
    }

    pub fn sd2ld(&self, amount_sd: u64) -> u64 {
        amount_sd * self.ld2sd_rate
    }

    pub fn remove_dust(&self, amount_ld: u64) -> u64 {
        amount_ld - amount_ld % self.ld2sd_rate
    }

    pub fn is_rate_limit_override(&self, account: &Pubkey) -> bool {
        self.rate_limit_override.contains(account)
    }
}

/// LzReceiveTypesAccounts includes accounts that are used in the LzReceiveTypes
/// instruction.
#[account]
#[derive(InitSpace)]
pub struct LzReceiveTypesAccounts {
    pub oft_store: Pubkey,
    pub token_mint: Pubkey,
}

#[test]
fn test_rate_limit_override() {
    let mut oft_store = OFTStore {
        oft_type: OFTType::Native,
        ld2sd_rate: 1000000000000000000,
        token_mint: Pubkey::new_unique(),
        token_escrow: Pubkey::new_unique(),
        endpoint_program: Pubkey::new_unique(),
        bump: 0,
        tvl_ld: 0,
        admin: Pubkey::new_unique(),
        default_fee_bps: 0,
        paused: false,
        pauser: None,
        unpauser: None,
        rate_limit_override: Vec::new(),
        rate_limit_override_count: 0,
        max_rate_limit_overrides: 10,
    };

    let admin = Pubkey::new_unique();
    oft_store.rate_limit_override.push(admin);
    assert!(oft_store.is_rate_limit_override(&admin));
}   