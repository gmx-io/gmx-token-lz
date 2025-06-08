use crate::*;

#[derive(Accounts)]
#[instruction(params: ManageRateLimitOverrideParams)]
pub struct ManageRateLimitOverride<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [OFT_SEED, oft_store.token_escrow.as_ref()],
        bump = oft_store.bump,
        has_one = admin @OFTError::Unauthorized
    )]
    pub oft_store: Account<'info, OFTStore>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ManageRateLimitOverrideParams {
    pub addresses: Vec<Pubkey>,
    pub actions: Vec<RateLimitOverrideAction>, // Add or Remove
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub enum RateLimitOverrideAction {
    Add,
    Remove,
}

impl ManageRateLimitOverride<'_> {
    pub fn apply(
        ctx: &mut Context<ManageRateLimitOverride>,
        params: &ManageRateLimitOverrideParams,
    ) -> Result<()> {
        require!(
            params.actions.len() == params.addresses.len(),
            OFTError::ManageRateLimitOverrideParamsLengthMismatch
        );

        for (action, address) in params.actions.iter().zip(params.addresses.iter()) {
            match action {
                RateLimitOverrideAction::Add => {
                    require!(
                        ctx.accounts.oft_store.rate_limit_override_count
                            < ctx.accounts.oft_store.max_rate_limit_overrides,
                        OFTError::RateLimitOverrideListFull
                    );
                    require!(
                        !ctx.accounts
                            .oft_store
                            .rate_limit_override
                            .contains(address),
                        OFTError::AddressAlreadyInOverrideList
                    );

                    ctx.accounts
                        .oft_store
                        .rate_limit_override
                        .push(*address);
                    ctx.accounts.oft_store.rate_limit_override_count = ctx
                        .accounts
                        .oft_store
                        .rate_limit_override_count
                        .saturating_add(1);
                    
                    emit!(RateLimitOverrideUpdated {
                        address: *address,
                        action: RateLimitOverrideAction::Add,
                    });
                }
                RateLimitOverrideAction::Remove => {
                    require!(
                        ctx.accounts
                            .oft_store
                            .rate_limit_override
                            .iter()
                            .position(|x| x == address)
                            .is_some(),
                        OFTError::AddressNotInOverrideList
                    );

                    let index = ctx
                        .accounts
                        .oft_store
                        .rate_limit_override
                        .iter()
                        .position(|x| x == address)
                        .unwrap();
                    ctx.accounts
                        .oft_store
                        .rate_limit_override
                        .swap_remove(index);
                    ctx.accounts.oft_store.rate_limit_override_count = ctx
                        .accounts
                        .oft_store
                        .rate_limit_override_count
                        .saturating_sub(1);
                    
                    emit!(RateLimitOverrideUpdated {
                        address: *address,
                        action: RateLimitOverrideAction::Remove,
                    });
                }
            }
        }
        Ok(())
    }
}
