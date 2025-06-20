use crate::*;

#[derive(Accounts)]
#[instruction(params: ManageRateLimitOverrideAddressParams)]
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

#[derive(Accounts)]
#[instruction(params: ManageRateLimitOverrideGuidParams)]
pub struct ManageRateLimitOverrideGuid<'info> {
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
pub struct ManageRateLimitOverrideAddressParams {
    pub addresses: Vec<Pubkey>,
    pub actions: Vec<RateLimitOverrideAction>, // Add or Remove
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ManageRateLimitOverrideGuidParams {
    pub guids: Vec<[u8; 32]>,
    pub actions: Vec<RateLimitOverrideAction>, // Add or Remove
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub enum RateLimitOverrideAction {
    Add,
    Remove,
}

impl ManageRateLimitOverride<'_> {
    pub fn apply_address(
        ctx: &mut Context<ManageRateLimitOverride>,
        params: &ManageRateLimitOverrideAddressParams,
    ) -> Result<()> {
        require!(
            params.actions.len() == params.addresses.len(),
            OFTError::ManageRateLimitOverrideParamsLengthMismatch
        );

        for (action, address) in params.actions.iter().zip(params.addresses.iter()) {
            Self::process_address_action(ctx, action, address)?;
        }
        Ok(())
    }

    pub fn apply_guid(
        ctx: &mut Context<ManageRateLimitOverride>,
        params: &ManageRateLimitOverrideGuidParams,
    ) -> Result<()> {
        require!(
            params.actions.len() == params.guids.len(),
            OFTError::ManageRateLimitOverrideParamsLengthMismatch
        );

        for (action, guid) in params.actions.iter().zip(params.guids.iter()) {
            Self::process_guid_action(ctx, action, guid)?;
        }
        Ok(())
    }

    fn process_address_action(
        ctx: &mut Context<ManageRateLimitOverride>,
        action: &RateLimitOverrideAction,
        address: &Pubkey,
    ) -> Result<()> {
        match action {
            RateLimitOverrideAction::Add => {
                require!(
                    ctx.accounts.oft_store.rate_limit_override.len()
                        < ctx.accounts.oft_store.max_rate_limit_overrides.into(),
                    OFTError::RateLimitOverrideListFull
                );
                require!(
                    !ctx.accounts.oft_store.rate_limit_override.contains(address),
                    OFTError::AlreadyInOverrideList
                );

                ctx.accounts.oft_store.rate_limit_override.push(*address);
                
                emit!(RateLimitOverrideUpdated {
                    address: *address,
                    action: RateLimitOverrideAction::Add,
                });
            }
            RateLimitOverrideAction::Remove => {
                let index = ctx.accounts.oft_store.rate_limit_override
                    .iter()
                    .position(|x| x == address)
                    .ok_or(OFTError::NotInOverrideList)?;

                ctx.accounts.oft_store.rate_limit_override.swap_remove(index);
                
                emit!(RateLimitOverrideUpdated {
                    address: *address,
                    action: RateLimitOverrideAction::Remove,
                });
            }
        }
        Ok(())
    }

    fn process_guid_action(
        ctx: &mut Context<ManageRateLimitOverride>,
        action: &RateLimitOverrideAction,
        guid: &[u8; 32],
    ) -> Result<()> {
        match action {
            RateLimitOverrideAction::Add => {
                require!(
                    ctx.accounts.oft_store.rate_limit_override_guids.len() < ctx.accounts.oft_store.max_rate_limit_override_guid_count.into(),
                    OFTError::RateLimitOverrideListFull
                );
                require!(
                    !ctx.accounts.oft_store.rate_limit_override_guids.contains(guid),
                    OFTError::AlreadyInOverrideList
                );

                ctx.accounts.oft_store.rate_limit_override_guids.push(*guid);
                
                emit!(RateLimitOverrideGuidUpdated {
                    guid: *guid,
                    action: RateLimitOverrideAction::Add,
                });
            }
            RateLimitOverrideAction::Remove => {
                let index = ctx.accounts.oft_store.rate_limit_override_guids
                    .iter()
                    .position(|x| x == guid)
                    .ok_or(OFTError::NotInOverrideList)?;

                ctx.accounts.oft_store.rate_limit_override_guids.swap_remove(index);
                
                emit!(RateLimitOverrideGuidUpdated {
                    guid: *guid,
                    action: RateLimitOverrideAction::Remove,
                });
            }
        }
        Ok(())
    }
}
