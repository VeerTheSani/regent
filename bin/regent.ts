#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program.name("regent").description("Autonomous local orchestrator daemon and CLI").version("0.0.0");

program.parse(process.argv);
