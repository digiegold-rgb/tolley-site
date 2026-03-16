import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const scan = await prisma.cryptoDriveScan.create({
    data: {
      label: "232GB ext4 — legg-1 Walton Mining Rig (Ubuntu)",
      devicePath: "/dev/sda1",
      filesystem: "ext4",
      totalSizeGb: 233,
      serialNumber: "SanDisk_SDSSDH3250G",
      scanStatus: "complete",
      scanDuration: 5,
      notes: [
        "Ubuntu Linux mining rig 'legg-1' — matches \\\\legg-1\\Walton Share from Drive 1 Sticky Notes.",
        "SmartMiner v3.1 for Waltonchain mining, connected to pool 74.83.61.29:33333.",
        "User: legg1. GPUs: 3 (cd 0 1 2). Installed Jul 2018, last used May 2019.",
        "Minimal system — just SmartMiner + SSH + tmux. No other crypto software found.",
        "Waltonchain mainnet addresses (66 chars) — not checkable on Etherscan.",
      ].join("\n"),
      itemCount: 0,
      items: {
        create: [
          {
            category: "keystore",
            subcategory: "waltonchain",
            filePath: "/home/legg1/Downloads/UTC--2018-07-11T00-44-40.203Z--3a1db3b1db9d59c45561beb1958dc17ede0a2e03d368ad62c40882230227b88e",
            sensitivity: "critical",
            contentPreview: "addr: 3a1d...b88e",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-legg1/copies/home/legg1/Downloads/UTC--2018-07-11T00-44-40.203Z--3a1db3b1db9d59c45561beb1958dc17ede0a2e03d368ad62c40882230227b88e",
            extractedData: {
              address: "3a1db3b1db9d59c45561beb1958dc17ede0a2e03d368ad62c40882230227b88e",
              network: "waltonchain-mainnet",
              notes: "Waltonchain mainnet keystore (64-char address, not ETH-compatible). Needs password.",
              needsPassword: true,
            },
            notes: "Waltonchain mainnet keystore. 64-char address — not on Ethereum.",
          },
          {
            category: "config_file",
            subcategory: "mining",
            filePath: "/home/legg1/start.sh",
            sensitivity: "normal",
            contentPreview: "SmartMiner.v3.1 → 74.83.61.29:33333",
            localCopyPath: "~/Desktop/crypto-extractions/scan-20260314-legg1/copies/home/legg1/start.sh",
            extractedData: {
              software: "SmartMiner v3.1",
              pool: "74.83.61.29:33333",
              address: "0xa082e0680bf17a5f64bc6d9c88b3fde22b56bf772b7b2789a23c40aba1ea6120",
              gpus: "3 (cd 0 1 2)",
              network: "waltonchain-mainnet",
              notes: "Waltonchain mining — 66-char mainnet address. Pool IP likely a private/local pool node.",
            },
            notes: "SmartMiner launch script — Waltonchain pool mining with 3 GPUs.",
          },
        ],
      },
    },
    include: { items: true },
  });

  await prisma.cryptoDriveScan.update({
    where: { id: scan.id },
    data: { itemCount: scan.items.length },
  });

  console.log(`Drive scan created: ${scan.id} (${scan.items.length} items)`);

  // Add wallet entry for the mining address
  const existing = await prisma.cryptoWallet.findFirst({
    where: { address: "0xa082e0680bf17a5f64bc6d9c88b3fde22b56bf772b7b2789a23c40aba1ea6120" },
  });
  if (!existing) {
    await prisma.cryptoWallet.create({
      data: {
        provider: "smartminer",
        network: "waltonchain",
        address: "0xa082e0680bf17a5f64bc6d9c88b3fde22b56bf772b7b2789a23c40aba1ea6120",
        balanceUsd: 0,
        mode: "recovery",
        balances: {
          WTC: null,
          source: "legg-1 mining rig — SmartMiner start.sh",
          pool: "74.83.61.29:33333",
          network: "waltonchain-mainnet",
          note: "66-char Waltonchain mainnet address. Not ETH-compatible.",
        },
      },
    });
    console.log("  Created wallet: 0xa082e068... (waltonchain)");
  }

  // Also add the keystore address
  const existing2 = await prisma.cryptoWallet.findFirst({
    where: { address: "3a1db3b1db9d59c45561beb1958dc17ede0a2e03d368ad62c40882230227b88e" },
  });
  if (!existing2) {
    await prisma.cryptoWallet.create({
      data: {
        provider: "keystore-drive",
        network: "waltonchain",
        address: "3a1db3b1db9d59c45561beb1958dc17ede0a2e03d368ad62c40882230227b88e",
        balanceUsd: 0,
        mode: "recovery",
        balances: {
          WTC: null,
          source: "legg-1 drive — Downloads/UTC--2018-07-11 keystore",
          network: "waltonchain-mainnet",
          needsPassword: true,
        },
      },
    });
    console.log("  Created wallet: 3a1db3b1... (waltonchain keystore)");
  }

  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
