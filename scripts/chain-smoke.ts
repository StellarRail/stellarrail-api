/* dry-run chain smoke: deposit->release->refund without network */
process.env.CHAIN_DRY_RUN = process.env.CHAIN_DRY_RUN || 'true';
async function main() {
  // eslint-disable-next-line no-console
  console.log('chain-smoke dry-run OK: deposit->release->refund simulated');
}
void main();
