use anchor_lang_idl::build::IdlBuilder;
use anyhow::{Context, Result};
use std::{env, fs, path::PathBuf};

fn main() -> Result<()> {
    use_installed_toolchain()?;
    let root = env::current_dir().context("resolve workspace root")?;
    let program = root.join("programs/summon");
    let output = root.join("target/idl/summon.json");
    let idl = IdlBuilder::new()
        .program_path(program)
        .resolution(true)
        .cargo_args(vec!["--offline".into()])
        .build()
        .context("generate Summon IDL")?;

    fs::create_dir_all(output.parent().expect("IDL output has a parent"))?;
    fs::write(&output, serde_json::to_vec_pretty(&idl)?)?;
    println!("Generated {}", display(&output));
    Ok(())
}

fn use_installed_toolchain() -> Result<()> {
    let home = env::var_os("HOME").context("HOME is not set")?;
    let toolchain_bin = PathBuf::from(home)
        .join(".rustup/toolchains/1.89.0-aarch64-apple-darwin/bin");
    let current_path = env::var_os("PATH").context("PATH is not set")?;
    let paths = std::iter::once(toolchain_bin).chain(env::split_paths(&current_path));
    env::set_var("PATH", env::join_paths(paths)?);
    env::remove_var("RUSTUP_TOOLCHAIN");
    Ok(())
}

fn display(path: &PathBuf) -> String {
    path.to_string_lossy().into_owned()
}
