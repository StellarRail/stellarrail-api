import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('chain')
@Controller({ path: 'chain', version: '1' })
export class ChainController {
  @Get('info') info() { return { dryRun: (process.env.CHAIN_DRY_RUN || 'true') === 'true', network: process.env.STELLAR_NETWORK || 'testnet', contract: process.env.ESCROW_CONTRACT_ID || 'unset' }; }
}
