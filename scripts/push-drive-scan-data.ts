import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── 1. Create the drive scan ─────────────────────────────────
  const scan = await prisma.cryptoDriveScan.create({
    data: {
      label: "232GB SanDisk NTFS — Old Mining Rig",
      devicePath: "/dev/sda4",
      filesystem: "ntfs3",
      totalSizeGb: 233,
      serialNumber: "SanDisk_SDSSDH3250G_DB0000000001",
      scanStatus: "complete",
      scanDuration: 11,
      notes: [
        "Old Windows drive from crypto mining operation (2016-2018 era).",
        "Mining rigs: Chirs, Daniel, Charles, MDcrypto, Steve1, Steve2, Steve3, Steve4.",
        "Pools: F2Pool, Coinotron (DigitalGold worker), NiceHash, Amoveo, Siacoin/Poloniex.",
        "Walton mining: 5 GPUs (1080s + 1070 Tis), 2.15-3.5 MH/s, 0.36-0.58% of WTC network.",
        "Sticky Notes SQLite was the biggest find — seed phrase, private key, all rig addresses.",
        "Email found: Qt4u2nv2008@yahoo.com",
      ].join("\n"),
      itemCount: 0, // updated after items created
      items: {
        create: [
          // ── Keystores (on drive, with funds) ──
          {
            category: "keystore",
            subcategory: "ethereum",
            filePath: "/Keys/UTC--2018-04-01T02-34-35.478247200Z--8aec7de707b6eecc6dae7537fbb8776870da6c13",
            sensitivity: "critical",
            contentPreview: "address: 0x8aec7de707b6eecc6dae7537fbb8776870da6c13",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/Keys/UTC--2018-04-01T02-34-35.478247200Z--8aec7de707b6eecc6dae7537fbb8776870da6c13",
            extractedData: {
              address: "0x8aec7de707b6eecc6dae7537fbb8776870da6c13",
              balanceETH: 0,
              balanceWTC: 51.0,
              explorerUrl: "https://etherscan.io/address/0x8aec7de707b6eecc6dae7537fbb8776870da6c13",
              keystoreVersion: 3,
              kdf: "scrypt",
              notes: "Walton mining rigs address. 51 WTC ERC-20 on-chain. Duplicate in /Test Rig folder/keystores Walton/",
            },
            notes: "Walton mining wallet — 51 WTC on-chain. Keystore needs password to unlock.",
          },
          {
            category: "keystore",
            subcategory: "ethereum",
            filePath: "/Test Rig folder/Ethereum Wallet/UTC--2016-05-12T04-29-15.108581658Z--a509d1d2d1d81e5d87e585cff27fd039466a1d85",
            sensitivity: "critical",
            contentPreview: "address: 0xa509d1d2d1d81e5d87e585cff27fd039466a1d85",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/Test Rig folder/Ethereum Wallet/UTC--2016-05-12T04-29-15.108581658Z--a509d1d2d1d81e5d87e585cff27fd039466a1d85",
            extractedData: {
              address: "0xa509d1d2d1d81e5d87e585cff27fd039466a1d85",
              balanceETH: 0.048883,
              balanceWTC: 0,
              explorerUrl: "https://etherscan.io/address/0xa509d1d2d1d81e5d87e585cff27fd039466a1d85",
              keystoreVersion: 3,
              kdf: "scrypt",
              notes: "Oldest keystore on drive (May 2016). Has 0.048883 ETH.",
            },
            notes: "2016 ETH wallet — 0.048883 ETH on-chain. Keystore needs password to unlock.",
          },
          {
            category: "keystore",
            subcategory: "ethereum",
            filePath: "/Keys/1.json",
            sensitivity: "critical",
            contentPreview: "address: 0x9d4e2d93dfc5e752a2156bc889bb3f211ee9d84c",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/Keys/1.json",
            extractedData: {
              address: "0x9d4e2d93dfc5e752a2156bc889bb3f211ee9d84c",
              balanceETH: 0,
              balanceWTC: 0,
              explorerUrl: "https://etherscan.io/address/0x9d4e2d93dfc5e752a2156bc889bb3f211ee9d84c",
              keystoreVersion: 3,
              kdf: "scrypt",
            },
            notes: "Empty wallet. Keystore in Keys/ folder.",
          },
          {
            category: "keystore",
            subcategory: "ethereum",
            filePath: "/Walton-Master/Fill in public here.json",
            sensitivity: "critical",
            contentPreview: "address: 0xce064df923694e164ba9f5e25812b8889f8c86fb",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/Walton-Master/Fill in public here.json",
            extractedData: {
              address: "0xce064df923694e164ba9f5e25812b8889f8c86fb",
              balanceETH: 0,
              balanceWTC: 0,
              explorerUrl: "https://etherscan.io/address/0xce064df923694e164ba9f5e25812b8889f8c86fb",
              notes: "Walton template keystore. Empty.",
            },
            notes: "Walton template wallet — empty.",
          },

          // ── Seed Phrase ──
          {
            category: "seed_phrase",
            subcategory: "bip39",
            filePath: "/Sticky Notes/plum.sqlite",
            sensitivity: "critical",
            contentPreview: "pyra...kirt",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/StickyNotes-plum.sqlite",
            extractedData: {
              derivedAddress: "0x1284B39FF7E00304AeE0189983Bc9460769b428E",
              wordCount: 12,
              balanceETH: 0,
              explorerUrl: "https://etherscan.io/address/0x1284B39FF7E00304AeE0189983Bc9460769b428E",
              derivationPath: "m/44'/60'/0'/0/0",
              notes: "Found in Windows Sticky Notes database. Derives to Bill's WTC mining address. Currently empty.",
            },
            notes: "12-word BIP39 seed in Sticky Notes. Derives to 0x1284... (Bill's WTC mining). Empty.",
          },

          // ── Private Key ──
          {
            category: "private_key",
            subcategory: "hex",
            filePath: "/Sticky Notes/plum.sqlite",
            sensitivity: "critical",
            contentPreview: "d015...92ce",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/StickyNotes-plum.sqlite",
            extractedData: {
              derivedAddress: "0x1284B39FF7E00304AeE0189983Bc9460769b428E",
              balanceETH: 0,
              explorerUrl: "https://etherscan.io/address/0x1284B39FF7E00304AeE0189983Bc9460769b428E",
              notes: "Same wallet as the seed phrase. Raw hex private key in Sticky Notes.",
            },
            notes: "Raw hex private key in Sticky Notes. Same wallet as seed phrase — 0x1284... Empty.",
          },

          // ── Addresses (from Sticky Notes — no keystore on drive) ──
          {
            category: "address",
            subcategory: "ethereum",
            filePath: "/Sticky Notes/plum.sqlite",
            sensitivity: "sensitive",
            contentPreview: "GMN: 0x599494e1e93ffd0f7f5a1921f9dff9f68d3db78a",
            extractedData: {
              address: "0x599494e1e93ffd0f7f5a1921f9dff9f68d3db78a",
              balanceETH: 0.028136,
              balanceWTC: 0,
              explorerUrl: "https://etherscan.io/address/0x599494e1e93ffd0f7f5a1921f9dff9f68d3db78a",
              label: "GMN (Guardian Master Node): Black, WTC, Walton2",
              miningCommand: 'miner.setEtherbase("0x599494e1e93ffd0f7f5a1921f9dff9f68d3db78a")',
              notes: "Has 0.028136 ETH. No keystore found on this drive — may be on another drive or managed by Walton node.",
            },
            notes: "GMN address — 0.028 ETH on-chain. No keystore on this drive. Check other drives.",
          },
          {
            category: "address",
            subcategory: "ethereum",
            filePath: "/Sticky Notes/plum.sqlite",
            sensitivity: "sensitive",
            contentPreview: "Coinbase Ether: 0x263E3033aB03aB611292E4b746E35340DFa9941B",
            extractedData: {
              address: "0x263E3033aB03aB611292E4b746E35340DFa9941B",
              balanceETH: 0,
              balanceWTC: 0,
              explorerUrl: "https://etherscan.io/address/0x263E3033aB03aB611292E4b746E35340DFa9941B",
              label: "Coinbase Ether / WTC mining",
              miningCommand: 'miner.start(0x263E3033aB03aB611292E4b746E35340DFa9941B)',
            },
            notes: "Coinbase Ether address — currently empty.",
          },
          {
            category: "address",
            subcategory: "bitcoin",
            filePath: "/Sticky Notes/plum.sqlite",
            sensitivity: "normal",
            contentPreview: "NiceHash payout: 34nH7AHp1A5fdjuSPHLb1LXLNM1MTmW83V",
            extractedData: {
              address: "34nH7AHp1A5fdjuSPHLb1LXLNM1MTmW83V",
              balanceBTC: 0,
              explorerUrl: "https://www.blockchain.com/btc/address/34nH7AHp1A5fdjuSPHLb1LXLNM1MTmW83V",
              label: "NiceHash mining payout",
            },
            notes: "BTC address from NiceHash mining. Empty.",
          },
          {
            category: "address",
            subcategory: "bitcoin",
            filePath: "/Sticky Notes/plum.sqlite",
            sensitivity: "normal",
            contentPreview: "Bill WTC: 38E1bhSSQ6Vw35WeE3bhbwSCHqY5eayHas",
            extractedData: {
              address: "38E1bhSSQ6Vw35WeE3bhbwSCHqY5eayHas",
              balanceBTC: 0,
              explorerUrl: "https://www.blockchain.com/btc/address/38E1bhSSQ6Vw35WeE3bhbwSCHqY5eayHas",
              label: "Bill's Walton address (BTC format)",
            },
            notes: "BTC-format address linked to Walton mining. Empty.",
          },
          {
            category: "address",
            subcategory: "siacoin",
            filePath: "/Sticky Notes/plum.sqlite",
            sensitivity: "normal",
            contentPreview: "Sia via Poloniex: 0551e4e5...816b",
            extractedData: {
              address: "0551e4e5777fd7446a2cceec338873586556f5a2dc7b6184e7309f2885cd4144f9a12d4d816b",
              label: "Siacoin mining to Poloniex",
            },
            notes: "Siacoin address — mining payout to Poloniex exchange.",
          },
          {
            category: "address",
            subcategory: "siacoin",
            filePath: "/Sticky Notes/plum.sqlite",
            sensitivity: "normal",
            contentPreview: "F2Pool: 86b6941393...cb51a8",
            extractedData: {
              address: "86b6941393a23c2647ec4acbcc33eadb9ce649a454fa5c7e7daa4f5db5055459092c33cb51a8",
              label: "F2Pool Siacoin",
            },
            notes: "F2Pool Siacoin address from Sticky Notes.",
          },

          // ── Mining configs ──
          {
            category: "config_file",
            subcategory: "mining",
            filePath: "/Test Rig folder/DigitalGold.bat",
            sensitivity: "normal",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/Test Rig folder/DigitalGold.bat",
            extractedData: {
              pool: "coinotron.com:3344",
              worker: "DigitalGold.Box-2",
              software: "ethminer-0.9.41-genoil-1.0.8",
            },
            notes: "ETH mining batch file — Coinotron pool, ethminer Genoil.",
          },
          {
            category: "config_file",
            subcategory: "mining",
            filePath: "/Test Rig folder/Info.txt",
            sensitivity: "normal",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/Test Rig folder/Info.txt",
            extractedData: {
              pools: ["coinotron.com:3344", "dcr.suprnova.cc:9111"],
              workers: ["DigitalGold.Mine40", "Redhex.rig1", "digie.Mine40", "Redhex.my"],
              software: "EthDcrMiner64 (Claymore Dual ETH+DCR)",
            },
            notes: "Claymore dual mining config — ETH + Decred on Coinotron + Suprnova.",
          },
          {
            category: "config_file",
            subcategory: "mining",
            filePath: "/Test Rig folder/StartMining.bat",
            sensitivity: "normal",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/Test Rig folder/StartMining.bat",
            extractedData: {
              commands: ["2_proxy.bat", "DigitalGold.bat"],
              user: "Jack Wheeler",
            },
            notes: "Mining launcher — starts proxy + DigitalGold mining.",
          },

          // ── Walton hash rate inventory (from Sticky Notes) ──
          {
            category: "document",
            subcategory: "mining-inventory",
            filePath: "/Sticky Notes/plum.sqlite",
            sensitivity: "normal",
            contentPreview: "Mining rig inventory from Sticky Notes",
            extractedData: {
              rigs: [
                { name: "MD-1080", hashRate: "300,000-700,000", gpu: "GTX 1080" },
                { name: "Walton#1-1080", hashRate: "300,000-700,000", gpu: "GTX 1080" },
                { name: "Walton#2-1080", hashRate: "430,000-700,000", gpu: "GTX 1080" },
                { name: "Walton#3-1070Ti", hashRate: "570,000-700,000", gpu: "GTX 1070 Ti" },
                { name: "Generation-1070Ti", hashRate: "330,000-700,000", gpu: "GTX 1070 Ti" },
              ],
              totalHashRate: "2,150,000-3,500,000 (2.15-3.5 MH/s)",
              networkPercent: "0.358%-0.583%",
              networkHashSpeed: "600 MH/s avg",
              machines: [
                "Chirs-X2FJ2", "Daniel-BWRJ2", "Charles-XW3PP",
                "MDcrypto-J44C2", "Steve1-JFHCP", "Steve2-TCQPP",
                "Steve3", "Steve4",
              ],
              waltonNetworkShare: "\\\\legg-1\\Walton Share",
              amoveo: {
                pool: "amoveopool2.com",
                notes: "1080 gets ~3GH/s, 1 VEO in ~20 days, VEO worth $160-200 OTC",
              },
              nicehash: {
                label: "Ethan Mine 4.0 Backup",
                btcAddress: "34nH7AHp1A5fdjuSPHLb1LXLNM1MTmW83V",
              },
            },
            notes: "Full mining rig inventory from Sticky Notes — 5 GPUs, 8 machines, multiple pools/coins.",
          },

          // ── Recovery codes ──
          {
            category: "document",
            subcategory: "recovery-codes",
            filePath: "/Keys/Codes for Splash top.txt",
            sensitivity: "sensitive",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/Keys/Codes for Splash top.txt",
            extractedData: {
              service: "Splashtop",
              type: "One-time recovery codes (8 codes)",
            },
            notes: "Splashtop 2FA recovery codes. 8 one-time codes.",
          },

          // ── Image ──
          {
            category: "qr_image",
            subcategory: "screenshot",
            filePath: "/Keys/Multi card Public address.PNG",
            sensitivity: "sensitive",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-210041/copies/Keys/Multi card Public address.PNG",
            extractedData: {
              description: "Screenshot of multi-GPU Walton mining rig setup with wallet addresses visible",
              resolution: "1915x1023",
            },
            notes: "Screenshot of WTC mining rig terminal — shows wallet imports across multiple GPUs.",
          },
        ],
      },
    },
    include: { items: true },
  });

  // Update item count
  await prisma.cryptoDriveScan.update({
    where: { id: scan.id },
    data: { itemCount: scan.items.length },
  });

  console.log(`Drive scan created: ${scan.id} (${scan.items.length} items)`);

  // ── 2. Create wallet entries ─────────────────────────────────
  const wallets = [
    {
      provider: "keystore-drive",
      network: "ethereum",
      address: "0xa509d1d2d1d81e5d87e585cff27fd039466a1d85",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        ETH: 0.048883,
        explorerUrl: "https://etherscan.io/address/0xa509d1d2d1d81e5d87e585cff27fd039466a1d85",
        source: "232GB SanDisk NTFS — keystore from 2016",
        keystorePath: "/Test Rig folder/Ethereum Wallet/UTC--2016-05-12T04-29-15.108581658Z--a509d1d2d1d81e5d87e585cff27fd039466a1d85",
        needsPassword: true,
      },
    },
    {
      provider: "keystore-drive",
      network: "ethereum",
      address: "0x8aec7de707b6eecc6dae7537fbb8776870da6c13",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        ETH: 0,
        WTC: 51.0,
        explorerUrl: "https://etherscan.io/address/0x8aec7de707b6eecc6dae7537fbb8776870da6c13",
        source: "232GB SanDisk NTFS — Walton mining rigs",
        keystorePath: "/Keys/UTC--2018-04-01T02-34-35.478247200Z--8aec7de707b6eecc6dae7537fbb8776870da6c13",
        needsPassword: true,
      },
    },
    {
      provider: "sticky-notes",
      network: "ethereum",
      address: "0x599494e1e93ffd0f7f5a1921f9dff9f68d3db78a",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        ETH: 0.028136,
        explorerUrl: "https://etherscan.io/address/0x599494e1e93ffd0f7f5a1921f9dff9f68d3db78a",
        source: "Sticky Notes — GMN (Guardian Master Node)",
        label: "GMN: Black, WTC, Walton2",
        needsPassword: true,
        note: "No keystore on this drive. May be on another drive.",
      },
    },
    {
      provider: "seed-phrase",
      network: "ethereum",
      address: "0x1284B39FF7E00304AeE0189983Bc9460769b428E",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        ETH: 0,
        explorerUrl: "https://etherscan.io/address/0x1284B39FF7E00304AeE0189983Bc9460769b428E",
        source: "Sticky Notes — seed phrase + raw private key",
        derivationPath: "m/44'/60'/0'/0/0",
        label: "Bill's WTC mining address",
        hasSeedPhrase: true,
        hasPrivateKey: true,
      },
    },
    {
      provider: "keystore-drive",
      network: "ethereum",
      address: "0x9d4e2d93dfc5e752a2156bc889bb3f211ee9d84c",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        ETH: 0,
        explorerUrl: "https://etherscan.io/address/0x9d4e2d93dfc5e752a2156bc889bb3f211ee9d84c",
        source: "232GB SanDisk NTFS — Keys/1.json",
        keystorePath: "/Keys/1.json",
        needsPassword: true,
      },
    },
    {
      provider: "keystore-drive",
      network: "ethereum",
      address: "0xce064df923694e164ba9f5e25812b8889f8c86fb",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        ETH: 0,
        explorerUrl: "https://etherscan.io/address/0xce064df923694e164ba9f5e25812b8889f8c86fb",
        source: "232GB SanDisk NTFS — Walton-Master template",
        keystorePath: "/Walton-Master/Fill in public here.json",
        needsPassword: true,
      },
    },
    {
      provider: "sticky-notes",
      network: "ethereum",
      address: "0x263E3033aB03aB611292E4b746E35340DFa9941B",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        ETH: 0,
        explorerUrl: "https://etherscan.io/address/0x263E3033aB03aB611292E4b746E35340DFa9941B",
        source: "Sticky Notes — Coinbase Ether / WTC mining",
      },
    },
    {
      provider: "sticky-notes",
      network: "bitcoin",
      address: "34nH7AHp1A5fdjuSPHLb1LXLNM1MTmW83V",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        BTC: 0,
        explorerUrl: "https://www.blockchain.com/btc/address/34nH7AHp1A5fdjuSPHLb1LXLNM1MTmW83V",
        source: "Sticky Notes — NiceHash mining payout",
        label: "Ethan Mine 4.0 Backup",
      },
    },
    {
      provider: "sticky-notes",
      network: "bitcoin",
      address: "38E1bhSSQ6Vw35WeE3bhbwSCHqY5eayHas",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        BTC: 0,
        explorerUrl: "https://www.blockchain.com/btc/address/38E1bhSSQ6Vw35WeE3bhbwSCHqY5eayHas",
        source: "Sticky Notes — Bill WTC",
      },
    },
    {
      provider: "sticky-notes",
      network: "siacoin",
      address: "0551e4e5777fd7446a2cceec338873586556f5a2dc7b6184e7309f2885cd4144f9a12d4d816b",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        SC: null,
        source: "Sticky Notes — Siacoin mining to Poloniex",
      },
    },
    {
      provider: "sticky-notes",
      network: "siacoin",
      address: "86b6941393a23c2647ec4acbcc33eadb9ce649a454fa5c7e7daa4f5db5055459092c33cb51a8",
      balanceUsd: 0,
      mode: "recovery",
      balances: {
        SC: null,
        source: "Sticky Notes — F2Pool Siacoin",
      },
    },
  ];

  for (const w of wallets) {
    // Upsert by address to avoid duplicates
    const existing = await prisma.cryptoWallet.findFirst({
      where: { address: w.address },
    });
    if (existing) {
      await prisma.cryptoWallet.update({
        where: { id: existing.id },
        data: w,
      });
      console.log(`  Updated wallet: ${w.address.slice(0, 10)}... (${w.network})`);
    } else {
      await prisma.cryptoWallet.create({ data: w });
      console.log(`  Created wallet: ${w.address.slice(0, 10)}... (${w.network})`);
    }
  }

  console.log(`\nDone. ${wallets.length} wallets, 1 drive scan with items.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
