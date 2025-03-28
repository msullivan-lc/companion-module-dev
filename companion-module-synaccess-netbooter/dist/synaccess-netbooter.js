"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Synaccess Netbooter NP-0801DUG2 Companion Module
const base_1 = require("@companion-module/base");
const buffer_1 = require("buffer"); // Needed for Base64 encoding
const REGEX_IP_ADDRESS = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
class SynaccessInstance extends base_1.InstanceBase {
    constructor(internal) {
        super(internal);
        this.outletCount = 8; // NP-0801DUG2 has 8 outlets
        // Explicitly declare config and initialize (helps with strict checks)
        // Although inherited, this makes it clearer for the type checker initially.
        this.config = { host: "" };
    }
    // Called when the module instance is initialized
    async init(config) {
        // The config is passed in here and assigned by the base class/update cycle
        await this.configUpdated(config);
    }
    // Called when the module instance is destroyed
    async destroy() {
        this.log("debug", "Destroying instance...");
        // No specific cleanup needed for simple HTTP requests
    }
    // Defines the configuration fields for the module instance
    getConfigFields() {
        return [
            {
                type: "static-text",
                id: "info",
                width: 12,
                label: "Information",
                value: "This module controls Synaccess Netbooter NP-0801DUG2 devices via HTTP.",
            },
            {
                type: "textinput",
                id: "host",
                label: "Target IP Address",
                width: 6,
                regex: REGEX_IP_ADDRESS.toString().slice(1, -1), // Pass the regex pattern as a string
                required: true,
            },
            {
                type: "textinput",
                id: "username",
                label: "Username (if auth enabled)",
                width: 6,
            },
            {
                type: "textinput",
                id: "password",
                label: "Password (if auth enabled)",
                width: 6,
                // Remove isPassword: true - rely on id: 'password' for UI masking
            },
        ];
    }
    // Called when the configuration is updated
    async configUpdated(config) {
        this.config = config; // Assign the received config
        this.updateStatus(base_1.InstanceStatus.Connecting);
        // Now this.config should be correctly typed and accessible
        if (!this.config.host) {
            this.updateStatus(base_1.InstanceStatus.BadConfig, "Target IP is required");
            return;
        }
        // Try a simple command to verify connection and auth
        await this.sendCommand("GET", 1);
        this.defineActions();
        // Optional: Add Feedbacks and Variables here later if needed
    }
    // --- Action Definitions ---
    defineActions() {
        const actions = {}; // Using 'any' for simplicity
        actions["set_outlet_state"] = {
            name: "Set Outlet State",
            options: [
                {
                    type: "dropdown",
                    label: "Outlet",
                    id: "outlet",
                    default: "1",
                    choices: Array.from({ length: this.outletCount }, (_, i) => ({
                        id: (i + 1).toString(),
                        label: `Outlet ${i + 1}`,
                    })),
                },
                {
                    type: "dropdown",
                    label: "State",
                    id: "state",
                    default: "1", // Default to ON
                    choices: [
                        { id: "1", label: "ON" },
                        { id: "0", label: "OFF" },
                    ],
                },
            ],
            callback: async (action) => {
                const outlet = parseInt(action.options.outlet, 10);
                const state = parseInt(action.options.state, 10);
                if (!isNaN(outlet) && !isNaN(state)) {
                    await this.sendCommand("REL", outlet, state);
                }
                else {
                    this.log("warn", `Invalid outlet or state received: ${action.options.outlet}, ${action.options.state}`);
                }
            },
        };
        for (let i = 1; i <= this.outletCount; i++) {
            actions[`outlet_${i}_on`] = {
                name: `Outlet ${i} ON`,
                options: [],
                callback: async () => {
                    await this.sendCommand("$A3", i, 0); //for some reason, Netbooter FW7.67 has the on and off bits flipped 
                },
            };
            actions[`outlet_${i}_off`] = {
                name: `Outlet ${i} OFF`,
                options: [],
                callback: async () => {
                    await this.sendCommand("$A3", i, 1); //for some reason, Netbooter FW7.67 has the on and off bits flipped
                },
            };
        }
        this.setActionDefinitions(actions);
    }
    // --- Helper Function to Send Commands ---
    async sendCommand(cmd, outlet, state) {
        // Check config using this.config
        if (!this.config.host) {
            this.log("warn", "No host configured");
            this.updateStatus(base_1.InstanceStatus.BadConfig, "Target IP is required");
            return;
        }
        let url = `http://${this.config.host}/cmd.cgi?${cmd} ${outlet} `;
        if (state !== undefined) {
            url += `${state}`;
        }
        this.log("debug", `Sending command: ${url}`);
        const headers = {};
        if (this.config.username && this.config.password) {
            const credentials = `${this.config.username}:${this.config.password}`;
            const base64Credentials = buffer_1.Buffer.from(credentials).toString("base64");
            headers["Authorization"] = `Basic ${base64Credentials}`;
        }
        try {
            // Use the global fetch API directly
            const response = await fetch(url, {
                method: "GET",
                headers: headers,
                signal: AbortSignal.timeout(5000), // 5 second timeout - good practice!
            });
            if (response.ok) {
                this.updateStatus(base_1.InstanceStatus.Ok);
                this.log("debug", `Command successful (Status: ${response.status})`);
                // const responseBody = await response.text();
                // this.log('debug', `Response: ${responseBody}`);
            }
            else if (response.status === 401) {
                this.updateStatus(base_1.InstanceStatus.AuthenticationFailure, "Authentication failed");
                this.log("error", "Authentication failed. Check username/password.");
            }
            else {
                this.updateStatus(base_1.InstanceStatus.UnknownError, `Request failed: ${response.status} ${response.statusText}`);
                this.log("error", `Request failed: ${response.status} ${response.statusText}`);
            }
        }
        catch (err) {
            let errorMsg = "Connection failed";
            // Check for timeout error specifically
            if (err.name === "TimeoutError" || err.name === "AbortError") {
                errorMsg = "Connection timed out";
            }
            else if (err.message) {
                errorMsg = `Connection failed: ${err.message}`;
            }
            this.updateStatus(base_1.InstanceStatus.ConnectionFailure, errorMsg);
            this.log("error", errorMsg);
        }
    }
}
(0, base_1.runEntrypoint)(SynaccessInstance, []);
