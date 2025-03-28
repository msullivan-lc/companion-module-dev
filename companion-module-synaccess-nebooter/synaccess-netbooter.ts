// Synaccess Netbooter NP-0801DUG2 Companion Module
import {
  InstanceBase,
  runEntrypoint,
  InstanceStatus,
  SomeCompanionConfigField
} from "@companion-module/base";
import { Buffer } from "buffer"; // Needed for Base64 encoding

const REGEX_IP_ADDRESS =
  /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;


// Module configuration fields
interface SynaccessConfig {
  host: string;
  username?: string;
  password?: string;
}

class SynaccessInstance extends InstanceBase<SynaccessConfig> {
  private outletCount = 8; // NP-0801DUG2 has 8 outlets

  // Explicitly declare config and initialize (helps with strict checks)
  // Although inherited, this makes it clearer for the type checker initially.
  public config: SynaccessConfig = { host: "" };

  constructor(internal: unknown) {
	super(internal);
  }

  // Called when the module instance is initialized
  async init(config: SynaccessConfig): Promise<void> {
	// The config is passed in here and assigned by the base class/update cycle
	await this.configUpdated(config);
  }

  // Called when the module instance is destroyed
  async destroy(): Promise<void> {
	this.log("debug", "Destroying instance...");
	// No specific cleanup needed for simple HTTP requests
  }

  // Defines the configuration fields for the module instance
  getConfigFields(): SomeCompanionConfigField[] {
	return [
	  {
		type: "static-text",
		id: "info",
		width: 12,
		label: "Information",
		value:
		  "This module controls Synaccess Netbooter NP-0801DUG2 devices via HTTP.",
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
  async configUpdated(config: SynaccessConfig): Promise<void> {
	this.config = config; // Assign the received config
	this.updateStatus(InstanceStatus.Connecting);

	// Now this.config should be correctly typed and accessible
	if (!this.config.host) {
	  this.updateStatus(
		InstanceStatus.BadConfig,
		"Target IP is required"
	  );
	  return;
	}

	// Try a simple command to verify connection and auth
	await this.sendCommand("GET", 1);

	this.defineActions();
	// Optional: Add Feedbacks and Variables here later if needed
  }

  // --- Action Definitions ---
  defineActions(): void {
	const actions: any = {}; // Using 'any' for simplicity

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
	  callback: async (action: {
		options: { outlet: string; state: string };
	  }) => {
		const outlet = parseInt(action.options.outlet, 10);
		const state = parseInt(action.options.state, 10);
		if (!isNaN(outlet) && !isNaN(state)) {
		  await this.sendCommand("REL", outlet, state);
		} else {
		  this.log(
			"warn",
			`Invalid outlet or state received: ${action.options.outlet}, ${action.options.state}`
		  );
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
	async sendCommand(
	  cmd: string,
	  outlet: number,
	  state?: number
	): Promise<void> {
	  // Check config using this.config
	  if (!this.config.host) {
		this.log("warn", "No host configured");
		this.updateStatus(
		  InstanceStatus.BadConfig,
		  "Target IP is required"
		);
		return;
	  }
  
	  let url = `http://${this.config.host}/cmd.cgi?${cmd} ${outlet} `;
	  if (state !== undefined) {
		url += `${state}`;
	  }
  
	  this.log("debug", `Sending command: ${url}`);
  
	  const headers: { [key: string]: string } = {};
	  if (this.config.username && this.config.password) {
		const credentials = `${this.config.username}:${this.config.password}`;
		const base64Credentials = Buffer.from(credentials).toString(
		  "base64"
		);
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
		  this.updateStatus(InstanceStatus.Ok);
		  this.log(
			"debug",
			`Command successful (Status: ${response.status})`
		  );
		  // const responseBody = await response.text();
		  // this.log('debug', `Response: ${responseBody}`);
		} else if (response.status === 401) {
		  this.updateStatus(
			InstanceStatus.AuthenticationFailure,
			"Authentication failed"
		  );
		  this.log("error", "Authentication failed. Check username/password.");
		} else {
		  this.updateStatus(
			InstanceStatus.UnknownError,
			`Request failed: ${response.status} ${response.statusText}`
		  );
		  this.log(
			"error",
			`Request failed: ${response.status} ${response.statusText}`
		  );
		}
	  } catch (err: any) {
		let errorMsg = "Connection failed";
		// Check for timeout error specifically
		if (err.name === "TimeoutError" || err.name === "AbortError") {
		  errorMsg = "Connection timed out";
		} else if (err.message) {
		  errorMsg = `Connection failed: ${err.message}`;
		}
		this.updateStatus(InstanceStatus.ConnectionFailure, errorMsg);
		this.log("error", errorMsg);
	  }
	}

}

runEntrypoint(SynaccessInstance, []);