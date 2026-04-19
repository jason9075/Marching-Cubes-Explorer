{
  description = "Marching Cubes Page Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            just
            entr
            http-server
            live-server
            typescript-language-server
            vscode-langservers-extracted # For HTML/CSS/JSON
          ];

          shellHook = ''
            echo "Entering Marching Cubes Development Environment"
            echo "Node version: $(node --version)"
            echo "Available tools: just, entr, http-server, live-server"
          '';
        };
      });
}
